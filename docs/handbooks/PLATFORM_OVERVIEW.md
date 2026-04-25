# TFT Clash - Platform Overview

> A 5-minute read for anyone trying to understand what this is, who it's for, and why it exists. Forward it freely.

---

## What it is

TFT Clash is a tournament platform for Teamfight Tactics. Hosts run branded tournaments. Players compete for free. Spectators watch live and chat. That's the product in one paragraph.

What makes it different from "just use Discord and a spreadsheet":
- **It looks like a real product.** Modern, dark-themed UI with realtime updates, mobile-friendly, no clunky form pages.
- **Branding belongs to the host.** A tournament page is 95% the host's brand and 5% TFT Clash chrome. We're infrastructure, not the marquee.
- **The economics work for everyone.** Players pay zero. Hosts keep 70-100% of revenue (depending on stream). Platform takes a cut only on flow we directly enable.
- **Everything is built in.** OBS overlay, live odds, share cards, calendar feed, match threads, sponsor placements - no plugin store, no third-party glue.

---

## The three-sided market

![Three sides, one platform](./assets/platform-overview.svg)

### Players

Free, always. They sign up, link their Riot ID, register for tournaments, and climb a season ladder. They get a public profile that doubles as a competitive resume. Optional Pro tier ($4.99/mo) for cosmetics + deeper analytics.

The platform's value to players is: **a real competitive structure** they can point to. "I finished top-5 on TFT Clash season 3" reads on a resume. "I won 12 lobbies in a Discord scrim" doesn't.

### Hosts

The paying customer ($19.99/mo flat). They get tournament-running tools so polished it feels embarrassing to go back to spreadsheets. They keep most of the revenue from sponsors, fans, and priority seats. The platform's job is to make running tournaments effortless and lucrative.

The platform's value to hosts is: **time, polish, and money**. Less time on bracket logistics, a polished page that attracts better sponsors, and revenue tools that don't exist anywhere else for this scene.

### Spectators

Free. They watch live brackets, chat in match threads, follow favorite players, subscribe to calendar feeds. They drive virality through share cards and social embeds.

The platform's value to spectators is: **the closest thing to traditional esports broadcasting** in a scene that doesn't have it. Live odds, polished podiums, replayable archives.

---

## How it makes money

### From hosts: $19.99/mo subscription

Flat fee. No per-tournament charges. Most hosts pay this off with a single sponsor deal in their first month.

### From sponsorship flow: 30%

When a sponsor pays a host through the platform's invoicing system, the platform takes 30%. The host gets 70%. The platform handles invoicing, tax forms, and the actual money movement - which is why the cut exists.

### From priority seat sales: 20%

Players pay 1-3 EUR to skip waitlists; the platform takes 20%, host gets 80%.

### From Pro subscriptions: $4.99/mo

Player-side cosmetics + deeper analytics. Pure platform revenue (not shared with hosts).

### Not from prize pools, fan tips, or anything else

The platform never takes a cut of player prize money or fan tips - those flow direct host-to-player or fan-to-host with zero platform fee.

---

## Why this exists

### The existing options suck

If you want to run a TFT tournament today, your options are:
1. **Discord + Sheets** - free but the UX is brutal, no live updates, manual everything.
2. **Battlefy / Toornament** - generic esports platforms, ugly, expensive at scale, no TFT-specific features (lobby seeding, EMEA scoring, comp analysis).
3. **Build your own** - 6+ months of full-time engineering work for something that'll never be as polished as a dedicated platform.

TFT Clash is what you'd build if you cared specifically about TFT and you had production-quality engineering time to invest. None of the existing options were designed for this game.

### The TFT scene needs better infrastructure

Riot doesn't run grassroots TFT tournaments. The community does. The community deserves tools that don't make them look amateur. Players deserve a competitive resume that travels. Hosts deserve to make money on their effort instead of doing it as a hobby that costs them money.

### It's the right size of problem

Big enough to be worth building well (a few hundred active hosts could each run weekly events for thousands of players each season). Small enough that one person + AI assistance can build a category-leading product without a war chest.

---

## What's shipped

- **Tournament builder** - flash, multi-round, multi-stage formats; templates; auto-scheduling.
- **Branded tournament pages** - custom name, banner, prize pool, sponsor placement.
- **Real-time bracket** - live placements, points, auto-advance, cut lines.
- **OBS overlay** - transparent browser source, theme support, lobby filtering.
- **Live odds** - per-roster win probability based on season form.
- **Match threads** - per-tournament chat boards, cross-tab synced.
- **Player profiles** - public, shareable, with performance heatmap + weird stat awards.
- **Follow/rival** - mark players to track on your dashboard.
- **Daily login streak** - cosmetic tier system (Spark -> Inferno).
- **Share cards** - 1200x630 SVG generator for socials.
- **Calendar feed** - .ics endpoint for Google/Apple Calendar.
- **Sponsor placements** - tournament page banner, OBS watermark, archive.
- **PayPal billing + payouts** - automatic weekly transfers.
- **Multi-tier pricing** - Free / Pro / Host with feature gates.
- **Hall of Fame + archive** - permanent record of every tournament + champion.

---

## What's coming

- **Riot API auto-scoring** - no more manual placement entry.
- **Custom domains** - white-label tournaments under host's own domain.
- **Multi-host events** - co-host with revenue split.
- **Tournament series** - 8-week leagues with cumulative standings.
- **Sponsor marketplace** - hosts and sponsors find each other directly.
- **Public read-only API** - third parties build on top.
- **Discord countdown widget** - embeds tournament countdowns into Discord servers.
- **VOD gallery** - past tournament VODs hosted/embedded with player tagging.

---

## Who's behind it

Built by [Levitate](https://tftclash.com/player/levitate) (also the season 1 champion - meta as hell). Solo dev with AI assistance. Lives in EU, plays on EUW, response time measured in hours not days.

Email: lodiestream@gmail.com

---

## Try it

- **As a player:** [tftclash.com/signup](https://tftclash.com/signup)
- **As a host:** [tftclash.com/host/apply](https://tftclash.com/host/apply)
- **As a sponsor:** email lodiestream@gmail.com with your brand + budget; we'll match you to fitting tournaments

This is what TFT tournaments should have looked like all along.
