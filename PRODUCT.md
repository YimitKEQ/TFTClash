# Product

## Register

product

The default surface is the tournament app: standings, leaderboard, brackets, events, account, admin, host dashboards, player profiles. The brand register kicks in only when working on the public-facing marketing surfaces: `/`, `/pricing`, `/faq`, `/season-recap`, and the Host application page.

## Users

Competitive Teamfight Tactics players across EUW, EUNE, and NA who want a real league experience without paywalls. They show up every week for an 8-player lobby clash, then track season standings, career stats, and Hall of Fame placement across the season. Skill level ranges from Iron to Challenger; the platform welcomes all ranks, but the heart of the audience is mid-to-high ELO players who care about long-term competitive identity.

A second user group is community hosts running their own tournaments inside the platform on the Host tier (€19.99/mo). They want fully branded, self-service tournament pages worth that price, not a generic Battlefy clone.

The founder, Levitate, is the current season champion. He is building this for his community while preparing it for public launch.

## Product Purpose

TFT Clash is the free competitive league for Teamfight Tactics. It runs weekly tournaments, calculates season points off the official EMEA Esports Rulebook (1st = 8 pts down to 8th = 1 pt), maintains a permanent Hall of Fame for past champions, and gives every player a career profile with full stats. Competing is always free. Pro (€4.99/mo) adds personalization and badges. Host (€19.99/mo) adds branded tournament hosting.

Success looks like three things in order:
1. Weekly clashes fill consistently with the same recognisable players returning.
2. The seasonal leaderboard becomes the source of truth for "who is the best in our league."
3. The Hall of Fame becomes a record players want their name on.

The longer-term bar is being credible enough that Riot Games would consider it as an acquisition target.

## Brand Personality

Three words: **Competitive, Community, Perfection.**

**Competitive.** Every screen treats the player like they are chasing a real ranking, not a casual side activity. Stats are first-class, points are precise, brackets feel high-stakes. Numerals always sit in `font-mono` so they read as tabular and unhedged.

**Community.** The league belongs to the players. Free to compete, always. Hosts and players share the same platform. Nothing about the tone should feel corporate or transactional. The italic Playfair Display accents ("competing is always free") carry the soul of this principle.

**Perfection.** Typography, spacing, and copy are tight. Nothing ships half-done. Every button works end-to-end. The product should look like a Riot-internal tool, not a side project. The bar is "defensible if a Riot product manager opens this."

Voice is direct and confident, never marketing-spin. Numbers are precise. Italic editorial accents are rare and load-bearing; everything else is functional.

## Anti-references

**op.gg.** Spreadsheet energy. Dense data tables stacked on dense data tables. No editorial voice, no narrative, no sense that competing here is an experience worth showing up for. TFT Clash has stats but is not a stats site.

**Mobalytics.** Neon-on-dark, gradient-heavy, generic gaming-SaaS aesthetic. Every esports tool in this category looks like this. TFT Clash must not.

The implied test: if a TFT player could swap our logo for any other esports stats or tournament site without noticing, the design has failed.

## In-lane references

**competetft.com.** Closest in-category reference. Watch for what they do well in the competitive-league lane and what they leave on the table.

**FACEIT, Start.gg.** Tournament-platform DNA: bracket pages, registration flows, lobby views, the feel of being inside a live event.

These set the floor for what tournament infrastructure should feel like, not the ceiling for visual ambition.

## Design Principles

1. **Free to compete is the loudest fact.** Pricing pressure never appears on the path between a player and the next clash. Tier upsells are quiet, opt-in, and secondary. Players who never upgrade should still feel like first-class citizens.

2. **Drama through type, not effects.** Russo One headlines, mono numerics, and rare Playfair Display italics carry visual energy. Glassmorphism, gradient text, side-stripe accent borders, and the big-number hero template are banned by reflex. Past "subtle" redesigns were rejected; the bar is dramatically distinct at a glance, achieved through scale, weight contrast, and hierarchy.

3. **Build to ship, not to demo.** Every button, link, and tab works end-to-end. No placeholders. No "coming soon" except as a deliberate, dated commitment in copy.

4. **Panel-based clarity.** The `<Panel>` component is the canonical container. Cards stay flat; nesting is forbidden. Spacing rhythms (not visual noise) carry hierarchy. The five-token typography scale is locked: `font-display`, `font-editorial`, `font-body`, `font-label`, `font-mono`.

5. **Riot-acquisition quality bar.** Every screen should be defensible if a Riot product manager opens it cold. That filter rejects most generic gaming-stack patterns by default.

## Accessibility & Inclusion

WCAG 2.1 AA as the baseline. No specific user accommodations have been requested or reported, but defaults assume:

- Color is never the only carrier of meaning. Placement, status, and rank always pair color with number, icon, or label.
- Reduced-motion users get static fallbacks for any animated transition. Layout properties are not animated.
- Keyboard navigation works on every interactive element. Focus is visible.
- Numeric content uses `font-mono` for tabular alignment and clearer screen-reader pronunciation.
