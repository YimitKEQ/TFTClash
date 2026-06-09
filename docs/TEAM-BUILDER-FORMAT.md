# Team Builder Format (research notes)

Reverse-engineered from TFT Academy's builder (`tftacademy.com/tools/builder/<code>`)
on 2026-06-09 to inform building our own comp builder / comp-display tool.

## How theirs works

- **Stack:** SvelteKit SPA. The comp is encoded entirely in the URL slug
  (e.g. `/builder/aaakal`) and decoded client-side. The route's `__data.json`
  was only ~191 bytes, so the server does not hold the comp; the slug *is* the comp.
- **Board:** a single player board, **4 rows x 7 columns = 28 hexes**, drawn with
  staggered (offset) rows, exactly like the in-game board.
- **Toolbar:** set selector, export/share/copy, toggles for Enemy board / unit
  Names / Traits, Undo / Redo / Clear, Add Units, plus Augment and Component pickers.
- **Traits panel:** auto-computed from the placed units and their breakpoints.

## Their data model (public asset APIs)

Per-set JSON, no auth required:

- `GET tftacademy.com/api/assets/champions?set=<n>`
- `GET tftacademy.com/api/assets/traits?set=<n>`
- `GET tftacademy.com/api/assets/augments?set=<n>`

Shapes:

```
champion = {
  apiName,            // "TFT17_Briar"  (Riot id, stable across tools)
  name, cost,         // 1..5
  traits: [traitId],  // references trait records by id
  role,               // "Attack Fighter"
  championSquareIcon, // webp filename on their CDN
  ability, stats, hexIndex
}

trait = {
  apiName, name,
  breakpoints: [1,2,3...],  // activation thresholds
  colors: [..],             // bronze/silver/gold/prismatic tiers
  description, icon, type
}
```

Champions reference traits by record id, so you resolve `champion.traits[]`
against the trait list to render the active traits + tiers.

## A serialized comp is

```
comp = {
  units: [
    { champ: apiName, hex: 0..27, star: 1|2|3, items: [itemId, itemId, itemId] }
  ],
  augments: [augId, augId, augId],
  level: number
}
```

Traits are derived, never stored. Pack that into a compact base-N URL slug
(their `aaakal`-style code) and the whole comp travels in a link.

## Recommendation for our build

- **Do not depend on their CDN or PocketBase.** Use the official asset source we
  already proved works for the Climb Guide: **CommunityDragon**
  (`raw.communitydragon.org/latest/cdragon/tft/en_us.json` for data,
  `raw.communitydragon.org/latest/game/<icon path>` for icons). It is the same
  source tactics.tools and MetaTFT use, set-versioned, no scraping.
- **Reuse the 4x7 hex board** we already built for the guide
  (`src/screens/guide/PositioningBoard.jsx`) as the seed for an interactive board.
- **Encoding:** design our own URL slug (base62 of `[level, ...units, ...augments]`)
  so a built comp is shareable as `/builder/<code>`, and embeddable as a read-only
  "recommended comp" card inside guides, the Clash hub, and host pages.
- **Phase 1 (low lift):** static, read-only comp cards (board + traits + items +
  augments) we author, for the guide's "meta comps" section.
- **Phase 2:** full interactive builder (drag units onto hexes, pick items/augments,
  share via slug).

Data source already validated locally; icons for the 8 base components are committed
under `public/guide/components/`.
