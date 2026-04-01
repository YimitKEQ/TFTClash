# Donut17 Full Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/donut17` Set 17 PBE prep tool with Galaxy Atlas visual direction, real drag-and-drop team builder, tier-rated comp lines, and a new Set 17 Augments tab.

**Architecture:** Standalone React page at `src/donut17/` with its own design tokens (`d17.js`), data files (`data/*.json`), tab components (`tabs/*.jsx`), and shared micro-components (`components/*.jsx`). Uses inline styles throughout (no Tailwind). All components follow the codebase rule: `var` declarations, `function(){}` callbacks, no arrow functions, no IIFEs in JSX, no named components inside other components.

**Tech Stack:** React 18, Vite 5, HTML5 Drag API, inline styles, Google Fonts (Barlow Condensed + Inter)

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/donut17/d17.js` | Modify | New color tokens, Barlow Condensed in F.headline |
| `src/donut17/Donut17Page.jsx` | Modify | New tab list (remove Grid, add Augments), Barlow Condensed font load, header redesign |
| `src/donut17/data/comp_lines.json` | Modify | Add `tier` field to all 10 comps |
| `src/donut17/tabs/CompLines.jsx` | Modify | New card layout, tier filter strip |
| `src/donut17/tabs/TeamBuilder.jsx` | Modify | Add HTML5 drag-and-drop (pool→board, board→board, board→remove) |
| `src/donut17/tabs/Champions.jsx` | Modify | Add Synergy Grid toggle view |
| `src/donut17/tabs/SynergyGrid.jsx` | Delete | Functionality moved to Champions toggle |
| `src/donut17/data/augments.json` | Rewrite | Replace Set 13 data with Set 17 augments |
| `src/donut17/tabs/Augments.jsx` | Create | New tab: filter by tier/trait, grid of augment cards |
| `src/donut17/tabs/OpenerAdvisor.jsx` | Modify | Replace old SectionHeader with new hero-style header |
| `src/donut17/tabs/Items.jsx` | Modify | Replace old header with new hero-style header |
| `src/donut17/tabs/Gods.jsx` | Modify | Replace old header with new hero-style header |

---

## Task 1: Update Design Tokens

**Files:**
- Modify: `src/donut17/d17.js`

- [ ] **Replace the contents of `d17.js` with updated tokens**

```javascript
// Donut17 design tokens — Galaxy Atlas v3

export var C = {
  bg:              '#0b0813',
  surface:         '#110e1c',
  surfaceLow:      '#0d0b17',
  surfaceHigh:     '#1a1628',
  surfaceHighest:  '#221d34',
  border:          '#2e2848',
  borderLight:     '#3d3660',
  primary:         '#c8b8ff',
  primaryDim:      '#9b8fcc',
  secondary:       '#7dc8ff',
  secondaryDim:    '#5ea0cc',
  tertiary:        '#f0cc00',
  tertiaryDim:     '#b89e00',
  orange:          '#ff8c42',
  text:            '#eceef8',
  textMuted:       '#d4d0e8',
  textDim:         '#a8a3be',
  textSub:         '#6b6585',
  success:         '#4ade80',
  error:           '#f87171',
  warn:            '#fbbf24',
};

export var F = {
  headline: "'Barlow Condensed', sans-serif",
  body:     "'Inter', sans-serif",
  label:    "'Inter', sans-serif",
};

export var COST_COLOR = {
  1: '#9ca3af',
  2: '#34d058',
  3: '#60a5fa',
  4: '#c084fc',
  5: '#f0cc00',
};

export var COST_GLOW = {
  1: 'rgba(156,163,175,0.25)',
  2: 'rgba(52,208,88,0.3)',
  3: 'rgba(96,165,250,0.3)',
  4: 'rgba(192,132,252,0.35)',
  5: 'rgba(240,204,0,0.4)',
};

export var TRAIT_COLOR = {
  origin: '#c8b8ff',
  class:  '#7dc8ff',
  unique: '#f0cc00',
};

export var TIER_COLOR = {
  S: '#c8b8ff',
  A: '#7dc8ff',
  B: '#f0cc00',
  C: '#6b6585',
};

export var TIER_BG = {
  S: 'rgba(200,184,255,0.15)',
  A: 'rgba(125,200,255,0.15)',
  B: 'rgba(240,204,0,0.12)',
  C: 'rgba(107,101,133,0.15)',
};
```

- [ ] **Verify build still compiles**

```bash
cd C:/Users/gubje/Downloads/tft-clash && npm run build 2>&1 | tail -5
```
Expected: no errors. Any "unused export" warnings are fine.

- [ ] **Commit**

```bash
cd C:/Users/gubje/Downloads/tft-clash
git add src/donut17/d17.js
git commit -m "feat: donut17 — new Galaxy Atlas design tokens + tier colors"
```

---

## Task 2: Update Donut17Page Header + Font

**Files:**
- Modify: `src/donut17/Donut17Page.jsx`

- [ ] **Replace the font useEffect to load Barlow Condensed instead of Space Grotesk**

Find this block (lines ~51-67) and replace with:
```javascript
  useEffect(function() {
    var fontId = "d17-fonts";
    if (!document.getElementById(fontId)) {
      var link = document.createElement("link");
      link.id = fontId;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
    var iconId = "d17-msymbols";
    if (!document.getElementById(iconId)) {
      var link2 = document.createElement("link");
      link2.id = iconId;
      link2.rel = "stylesheet";
      link2.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200";
      document.head.appendChild(link2);
    }
  }, []);
```

- [ ] **Update TABS array** — remove `grid`, add `augments`

```javascript
var TABS = [
  { id: "opener",   label: "Opener",    icon: "grid_view" },
  { id: "builder",  label: "Builder",   icon: "dashboard" },
  { id: "comps",    label: "Comps",     icon: "bar_chart" },
  { id: "champs",   label: "Champions", icon: "group" },
  { id: "items",    label: "Items",     icon: "shield" },
  { id: "augments", label: "Augments",  icon: "auto_awesome" },
  { id: "gods",     label: "Gods",      icon: "military_tech" },
];
```

- [ ] **Update ACCENTCOLORS**

```javascript
var ACCENTCOLORS = {
  opener:   C.primary,
  builder:  C.primary,
  comps:    C.tertiary,
  champs:   C.primary,
  items:    C.secondary,
  augments: C.orange,
  gods:     C.tertiary,
};
```

- [ ] **Update the header style** — deeper bg, Barlow Condensed logo

Replace the `<header>` element's logo div:
```javascript
          <div style={{ fontFamily: F.headline, fontWeight: 800, fontSize: 20, letterSpacing: 4, color: C.text, textTransform: "uppercase" }}>
            DONUT<span style={{ color: C.primary }}>17</span>
          </div>
```

Replace the header background style value from `C.bg + "e8"` to `"rgba(11,8,19,0.92)"`.

- [ ] **Update main content render** — swap grid tab for augments, import Augments

Add import at top of file:
```javascript
import Augments from "./tabs/Augments.jsx";
```

In the render block, replace:
```javascript
            {tab === "grid"    && <SynergyGrid   champions={championsData} traits={traitsData} />}
```
with:
```javascript
            {tab === "augments" && <Augments />}
```

Remove the SynergyGrid import line.

Also update Champions render to pass `traits` (it already does — no change needed).

Update the comp tab render:
```javascript
            {tab === "comps"   && <CompLines      compLines={compLinesData} champions={championsData} />}
```
(already correct)

- [ ] **Verify dev server shows new nav without Grid, with Augments tab**

```bash
cd C:/Users/gubje/Downloads/tft-clash && npm run dev
```
Open http://localhost:5173/donut17 and confirm 7 tabs: Opener, Builder, Comps, Champions, Items, Augments, Gods.

- [ ] **Commit**

```bash
git add src/donut17/Donut17Page.jsx
git commit -m "feat: donut17 — update nav tabs, Barlow Condensed font, deeper bg"
```

---

## Task 3: Add Tier Data to comp_lines.json

**Files:**
- Modify: `src/donut17/data/comp_lines.json`

- [ ] **Add `"tier"` field to each comp** — open the file and add the field after `"strategy"` for each entry:

| Comp id | tier |
|---------|------|
| `darkstar-vertical` | `"S"` |
| `nova-bastion` | `"A"` |
| `anima-reroll` | `"A"` |
| `stargazer-stack` | `"B"` |
| `space-groove-6` | `"B"` |
| `rogue-assassin` | `"A"` |
| `meeple-6` | `"B"` |
| `channeler-ap` | `"A"` |
| `vanguard-frontline` | `"B"` |
| any remaining comp | `"C"` |

Example for the first entry — find `"strategy": "FAST 8"` under `darkstar-vertical` and add the tier right after:
```json
    "strategy": "FAST 8",
    "tier": "S"
```

- [ ] **Commit**

```bash
git add src/donut17/data/comp_lines.json
git commit -m "feat: donut17 — add S/A/B/C tier ratings to all comp lines"
```

---

## Task 4: Rebuild CompLines.jsx — Galaxy Atlas Cards + Tier Filter

**Files:**
- Modify: `src/donut17/tabs/CompLines.jsx`

- [ ] **Replace the entire file** with the new Galaxy Atlas card design:

```javascript
import React, { useState } from "react";
import { C, F, COST_COLOR, TIER_COLOR, TIER_BG } from "../d17.js";
import ChampIcon from "../components/ChampIcon.jsx";
import ItemIcon from "../components/ItemIcon.jsx";

var STRATEGY_COLOR = {
  "FAST 8":   C.secondary,
  "FAST 7":   C.secondary,
  "FAST 9":   C.secondary,
  "REROLL 6": C.primary,
  "REROLL 7": C.primary,
  "FLEX":     "#a8a3be",
};

var ALL_TIERS = ["S", "A", "B", "C"];

function CompLines({ compLines, champions }) {
  var [expanded, setExpanded] = useState(null);
  var [tierFilter, setTierFilter] = useState([]);

  var filtered = compLines.filter(function(comp) {
    if (tierFilter.length === 0) return true;
    return tierFilter.includes(comp.tier || "C");
  });

  function toggleTier(t) {
    setTierFilter(function(prev) {
      return prev.includes(t) ? prev.filter(function(x) { return x !== t; }) : prev.concat([t]);
    });
  }

  return (
    <div>
      {/* Hero header */}
      <div style={{
        background: "linear-gradient(180deg, rgba(124,58,237,0.12) 0%, transparent 100%)",
        borderBottom: "1px solid " + C.border,
        padding: "32px 0 28px",
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, fontFamily: F.headline, fontWeight: 700, color: C.primary, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6, opacity: 0.85 }}>Set 17 · Space Gods</div>
        <h2 style={{ fontFamily: F.headline, fontWeight: 800, fontSize: 42, textTransform: "uppercase", letterSpacing: -1, color: C.text, lineHeight: 1, margin: "0 0 10px" }}>
          Comp Lines
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 12, color: C.textDim, margin: 0, maxWidth: 500 }}>
          {compLines.length} theorycrafted compositions — core board, BIS items, game plan, god pick.
        </p>
      </div>

      {/* Tier filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {ALL_TIERS.map(function(t) {
          var active = tierFilter.includes(t);
          return (
            <button
              key={t}
              onClick={function() { toggleTier(t); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: active ? TIER_BG[t] : C.surface,
                border: "1px solid " + (active ? TIER_COLOR[t] + "55" : C.border),
                padding: "6px 14px 6px 6px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: 26, height: 26,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? TIER_BG[t] : "transparent",
                fontFamily: F.headline, fontWeight: 800, fontSize: 15,
                color: TIER_COLOR[t],
              }}>{t}</div>
              <span style={{ fontFamily: F.headline, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: active ? C.textMuted : C.textSub }}>
                {t === "S" ? "God-tier" : t === "A" ? "Strong" : t === "B" ? "Situational" : "Off-meta"}
              </span>
            </button>
          );
        })}
        {tierFilter.length > 0 && (
          <button
            onClick={function() { setTierFilter([]); }}
            style={{ background: "transparent", border: "1px solid " + C.border, padding: "6px 12px", cursor: "pointer", fontFamily: F.label, fontSize: 11, color: C.textSub, letterSpacing: 1, textTransform: "uppercase" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Comp cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {filtered.map(function(comp) {
          var isExp = expanded === comp.id;
          var tier = comp.tier || "C";
          var stratCol = STRATEGY_COLOR[comp.strategy] || C.borderLight;
          return (
            <div key={comp.id} style={{ background: isExp ? C.surface : C.surfaceLow, border: "1px solid " + (isExp ? C.borderLight : C.border), overflow: "hidden", transition: "background 0.15s" }}>

              {/* Splash top bar */}
              <div style={{
                height: 4,
                background: "linear-gradient(90deg, " + comp.color + ", " + comp.color + "44)",
              }} />

              {/* Header row */}
              <div
                style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                onClick={function() { setExpanded(isExp ? null : comp.id); }}
              >
                {/* Tier badge */}
                <div style={{
                  width: 32, height: 32, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: TIER_BG[tier],
                  fontFamily: F.headline, fontWeight: 800, fontSize: 16,
                  color: TIER_COLOR[tier],
                }}>
                  {tier}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: F.headline, fontSize: 20, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 0.5 }}>{comp.name}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", background: stratCol + "22", color: stratCol, fontFamily: F.headline, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", border: "1px solid " + stratCol + "44" }}>{comp.strategy}</span>
                  </div>
                  <p style={{ fontFamily: F.body, fontSize: 11, color: C.textDim, margin: 0 }}>{comp.desc}</p>
                </div>

                {/* Carry BIS items */}
                {comp.items && comp.carry && comp.items[comp.carry] && (
                  <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0, borderLeft: "1px solid " + C.border, paddingLeft: 12 }}>
                    {comp.items[comp.carry].map(function(itemKey, ii) {
                      return <ItemIcon key={ii} itemKey={itemKey} size={26} />;
                    })}
                  </div>
                )}

                {/* Core portraits */}
                <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
                  {comp.core.map(function(key) {
                    var ch = champions.find(function(c) { return c.key === key; });
                    if (!ch) return null;
                    return (
                      <div key={key} style={{ position: "relative" }}>
                        <ChampIcon champ={ch} size={38} />
                        {key === comp.carry && (
                          <div style={{ position: "absolute", top: -3, right: -3, width: 11, height: 11, background: comp.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6, fontWeight: 900, fontFamily: F.label, color: "#000" }}>C</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Chevron */}
                <div style={{ color: C.textSub, fontSize: 16, flexShrink: 0, transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</div>
              </div>

              {/* Expanded details */}
              {isExp && (
                <div style={{ borderTop: "1px solid " + C.border, padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontFamily: F.headline, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: C.textSub, marginBottom: 8 }}>Game Plan</div>
                    <p style={{ fontFamily: F.body, fontSize: 12, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>{comp.gameplan}</p>
                  </div>
                  <div>
                    <div style={{ fontFamily: F.headline, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: C.textSub, marginBottom: 8 }}>God Pick</div>
                    <div style={{ fontFamily: F.headline, fontSize: 15, fontWeight: 700, color: C.tertiary, marginBottom: 4 }}>{comp.god}</div>
                    <p style={{ fontFamily: F.body, fontSize: 11, color: C.textDim, margin: 0 }}>{comp.godWhy}</p>
                  </div>
                  {comp.flex && comp.flex.length > 0 && (
                    <div>
                      <div style={{ fontFamily: F.headline, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: C.textSub, marginBottom: 8 }}>Flex Units</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {comp.flex.map(function(key) {
                          var ch = champions.find(function(c) { return c.key === key; });
                          if (!ch) return null;
                          return <ChampIcon key={key} champ={ch} size={32} />;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CompLines;
```

- [ ] **Check build compiles**

```bash
cd C:/Users/gubje/Downloads/tft-clash && npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add src/donut17/tabs/CompLines.jsx src/donut17/data/comp_lines.json
git commit -m "feat: donut17 — Galaxy Atlas comp cards with S/A/B/C tier filter"
```

---

## Task 5: TeamBuilder — HTML5 Drag-and-Drop

**Files:**
- Modify: `src/donut17/tabs/TeamBuilder.jsx`

The current model is click-to-place (click pool → pending → click hex). We keep that as fallback but add full drag-and-drop.

**Drag model:**
- Module-level `var gDrag` stores drag source (avoids React closure staleness)
- Pool champ drag → `{ src: "pool", champ }`
- Board champ drag → `{ src: "board", hid, champ }`
- Drop on hex: place / move / swap
- Drop on pool area: remove from board
- `dragOverHid` React state drives hover highlight

- [ ] **Add module-level drag state variable** — add this after the imports, before the board constants:

```javascript
// Module-level drag state (avoids stale closure in drop handlers)
var gDrag = { src: null, champ: null, hid: null };
```

- [ ] **Add drag handlers to PoolIcon component** — replace the existing `PoolIcon` function:

```javascript
function PoolIcon({ champ, placed, onClick, onDragStart }) {
  var [err, setErr] = useState(false);
  var col = COST_COLOR[champ.cost];
  var glow = COST_GLOW[champ.cost];
  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={function(e) { onDragStart(e, champ); }}
      title={champ.name + " (" + champ.cost + "g)"}
      style={{
        cursor: "grab",
        width: 42,
        height: 46,
        position: "relative",
        opacity: placed ? 0.35 : 1,
        transition: "opacity 0.1s, filter 0.1s",
        filter: placed ? "none" : "drop-shadow(0 1px 3px " + glow + ")",
      }}
    >
      <div style={{
        width: 42,
        height: 46,
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        overflow: "hidden",
        outline: "1.5px solid " + col + "66",
        outlineOffset: 1,
      }}>
        {!err && champ.assets && champ.assets.face ? (
          <img src={champ.assets.face} alt={champ.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }} onError={function() { setErr(true); }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: col + "28", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: col, fontFamily: F.label, fontWeight: 700 }}>
            {champ.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      {placed > 0 && (
        <div style={{ position: "absolute", top: 1, right: -2, width: 13, height: 13, background: col, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontFamily: F.label, fontWeight: 900, color: "#000", borderRadius: 0 }}>
          {placed}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Add drag props to BoardHex component** — replace the existing `BoardHex` function signature and hex content div:

Replace the function signature:
```javascript
function BoardHex({ hid, r, c, champ, items, stars, selected, pending, dragOver, onClickHex, onRemoveItem, onDragStart, onDragOver, onDrop, onDragEnd }) {
```

Add these props to the outermost wrapper div of BoardHex (the `position: "absolute"` div):
```javascript
      draggable={!!champ}
      onDragStart={champ ? function(e) { onDragStart(e, hid, champ); } : undefined}
      onDragOver={function(e) { onDragOver(e, hid); }}
      onDrop={function(e) { onDrop(e, hid); }}
      onDragEnd={onDragEnd}
```

Update the hex content div outline to show dragOver highlight:
```javascript
          outline: "2px solid " + (dragOver ? C.secondary : selected ? C.primary : isEmpty ? C.border : col + "88"),
```

- [ ] **Add drag handlers to TeamBuilder main component** — inside the `TeamBuilder` function, add state and handlers after the existing state declarations:

```javascript
  var [dragOverHid, setDragOverHid] = useState(null);

  function handlePoolDragStart(e, champ) {
    gDrag = { src: "pool", champ: champ, hid: null };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", champ.key);
  }

  function handleBoardDragStart(e, hid, champ) {
    gDrag = { src: "board", champ: champ, hid: hid };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", hid);
  }

  function handleHexDragOver(e, hid) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverHid(hid);
  }

  function handleHexDrop(e, targetHid) {
    e.preventDefault();
    setDragOverHid(null);
    if (!gDrag.src) return;
    saveHistory();
    if (gDrag.src === "pool") {
      setBoard(function(prev) {
        var next = Object.assign({}, prev);
        next[targetHid] = gDrag.champ;
        return next;
      });
      setSelected(targetHid);
    } else if (gDrag.src === "board" && gDrag.hid !== targetHid) {
      var srcHid = gDrag.hid;
      setBoard(function(prev) {
        var next = Object.assign({}, prev);
        var srcChamp = next[srcHid];
        var tgtChamp = next[targetHid];
        next[targetHid] = srcChamp;
        next[srcHid] = tgtChamp;
        return next;
      });
      setSelected(targetHid);
    }
    gDrag = { src: null, champ: null, hid: null };
  }

  function handleDragEnd() {
    setDragOverHid(null);
    gDrag = { src: null, champ: null, hid: null };
  }

  function handlePoolAreaDrop(e) {
    e.preventDefault();
    if (gDrag.src === "board" && gDrag.hid) {
      saveHistory();
      var srcHid = gDrag.hid;
      setBoard(function(prev) {
        var next = Object.assign({}, prev);
        next[srcHid] = null;
        return next;
      });
      if (selected === srcHid) setSelected(null);
    }
    setDragOverHid(null);
    gDrag = { src: null, champ: null, hid: null };
  }
```

- [ ] **Wire up the handlers in the render** — update the BoardHex render call to pass new props:

Find the `<BoardHex .../>` JSX and add:
```javascript
                    dragOver={dragOverHid === hid}
                    onDragStart={handleBoardDragStart}
                    onDragOver={handleHexDragOver}
                    onDrop={handleHexDrop}
                    onDragEnd={handleDragEnd}
```

Update PoolIcon to pass drag handler:
```javascript
              <PoolIcon
                key={ch.key}
                champ={ch}
                placed={boardChampCounts[ch.key] || 0}
                onClick={function() { handlePoolClick(ch); }}
                onDragStart={handlePoolDragStart}
              />
```

- [ ] **Add drop zone to pool area** — wrap the pool section container div with drag handlers:

```javascript
      onDragOver={function(e) { e.preventDefault(); }}
      onDrop={handlePoolAreaDrop}
```

- [ ] **Verify drag works in dev server** — open http://localhost:5173/donut17, go to Builder tab, drag a champion from pool to a hex board slot.

- [ ] **Commit**

```bash
git add src/donut17/tabs/TeamBuilder.jsx
git commit -m "feat: donut17 — HTML5 drag-and-drop team builder (pool->board, swap, remove)"
```

---

## Task 6: Champions Tab — Synergy Grid Toggle

**Files:**
- Modify: `src/donut17/tabs/Champions.jsx`

- [ ] **Add a view toggle at the top of the Champions component** — add import and state:

At the top of `Champions.jsx`, add import for SynergyGrid data:
```javascript
import synergyData from "../data/synergy_grid.json";
```

Inside the `Champions` function, add view state after existing state:
```javascript
  var [view, setView] = useState("cards");
```

- [ ] **Add toggle buttons above the search bar** — insert before the search/filter row:

```javascript
      {/* View toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        <button
          onClick={function() { setView("cards"); }}
          style={{ padding: "6px 16px", background: view === "cards" ? C.primary + "22" : "transparent", border: "1px solid " + (view === "cards" ? C.primary : C.border), color: view === "cards" ? C.primary : C.textDim, fontFamily: F.headline, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}
        >
          Champions
        </button>
        <button
          onClick={function() { setView("grid"); }}
          style={{ padding: "6px 16px", background: view === "grid" ? C.secondary + "22" : "transparent", border: "1px solid " + (view === "grid" ? C.secondary : C.border), color: view === "grid" ? C.secondary : C.textDim, fontFamily: F.headline, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}
        >
          Synergy Grid
        </button>
      </div>
```

- [ ] **Wrap existing champion content in a conditional** — surround all existing JSX after the toggle with `{view === "cards" && (...)}`.

Then add the grid view after it:
```javascript
      {view === "grid" && (
        <SynergyGridInline champions={champions} traits={traits} synergyData={synergyData} />
      )}
```

- [ ] **Create `SynergyGridInline` as a standalone function** (outside `Champions`, at the bottom of the file):

```javascript
function SynergyGridInline({ champions, traits }) {
  var origins = traits.filter(function(t) { return t.type === "origin" || t.type === "class"; }).slice(0, 16);
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ fontFamily: F.headline, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: C.textSub, marginBottom: 12 }}>
        Trait overlap by champion — how many traits two champs share
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 4 }}>
        {origins.map(function(trait) {
          var champs = champions.filter(function(c) { return c.traits.includes(trait.name); });
          return (
            <div key={trait.key} style={{ background: C.surface, border: "1px solid " + C.border, padding: "10px 12px" }}>
              <div style={{ fontFamily: F.headline, fontSize: 13, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{trait.name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {champs.map(function(ch) {
                  return (
                    <div key={ch.key} title={ch.name} style={{ width: 28, height: 28, clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", overflow: "hidden", background: (COST_COLOR[ch.cost] || "#6b7280") + "44", outline: "1px solid " + (COST_COLOR[ch.cost] || "#6b7280") + "66", outlineOffset: -1 }}>
                      {ch.assets && ch.assets.face ? (
                        <img src={ch.assets.face} alt={ch.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: COST_COLOR[ch.cost], fontFamily: F.label, fontWeight: 700 }}>{ch.name.slice(0, 2).toUpperCase()}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Add the `COST_COLOR` import to `Champions.jsx`:
```javascript
import { C, F, COST_COLOR, TRAIT_COLOR } from "../d17.js";
```

- [ ] **Build check**

```bash
cd C:/Users/gubje/Downloads/tft-clash && npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add src/donut17/tabs/Champions.jsx
git commit -m "feat: donut17 — synergy grid toggle inside Champions tab"
```

---

## Task 7: Rebuild augments.json + Create Augments.jsx

**Files:**
- Rewrite: `src/donut17/data/augments.json`
- Create: `src/donut17/tabs/Augments.jsx`

- [ ] **Replace augments.json** with Set 17 data (tier: 1=Silver, 2=Gold, 3=Prismatic):

```json
[
  { "name": "Dark Star Heart", "desc": "Gain a Dark Star Emblem and a Cho'Gath.", "tier": 1, "tierLabel": "Silver", "traits": ["Dark Star"], "icon": "https://ap.tft.tools/static/augment-icons/new17_darkstar_heart.svg" },
  { "name": "Dark Star Crest", "desc": "Gain a Dark Star Emblem and a Lissandra.", "tier": 2, "tierLabel": "Gold", "traits": ["Dark Star"], "icon": "https://ap.tft.tools/static/augment-icons/new17_darkstar_crest.svg" },
  { "name": "Dark Star Crown", "desc": "Gain a Dark Star Emblem, a Jhin, and a Karma.", "tier": 3, "tierLabel": "Prismatic", "traits": ["Dark Star"], "icon": "https://ap.tft.tools/static/augment-icons/new17_darkstar_crown.svg" },
  { "name": "N.O.V.A. Heart", "desc": "Gain a N.O.V.A. Emblem and an Aatrox.", "tier": 1, "tierLabel": "Silver", "traits": ["N.O.V.A."], "icon": "https://ap.tft.tools/static/augment-icons/new17_nova_heart.svg" },
  { "name": "N.O.V.A. Crest", "desc": "Gain a N.O.V.A. Emblem and a Caitlyn.", "tier": 2, "tierLabel": "Gold", "traits": ["N.O.V.A."], "icon": "https://ap.tft.tools/static/augment-icons/new17_nova_crest.svg" },
  { "name": "N.O.V.A. Crown", "desc": "Gain a N.O.V.A. Emblem, an Akali, and a Kindred.", "tier": 3, "tierLabel": "Prismatic", "traits": ["N.O.V.A."], "icon": "https://ap.tft.tools/static/augment-icons/new17_nova_crown.svg" },
  { "name": "Anima Heart", "desc": "Gain an Anima Emblem and a Briar.", "tier": 1, "tierLabel": "Silver", "traits": ["Anima"], "icon": "https://ap.tft.tools/static/augment-icons/new17_anima_heart.svg" },
  { "name": "Anima Crest", "desc": "Gain an Anima Emblem and a Jinx.", "tier": 2, "tierLabel": "Gold", "traits": ["Anima"], "icon": "https://ap.tft.tools/static/augment-icons/new17_anima_crest.svg" },
  { "name": "Anima Crown", "desc": "Gain an Anima Emblem, a Jinx, and an Aurora.", "tier": 3, "tierLabel": "Prismatic", "traits": ["Anima"], "icon": "https://ap.tft.tools/static/augment-icons/new17_anima_crown.svg" },
  { "name": "Rogue Heart", "desc": "Gain a Rogue Emblem and a Briar.", "tier": 1, "tierLabel": "Silver", "traits": ["Rogue"], "icon": "https://ap.tft.tools/static/augment-icons/new17_rogue_heart.svg" },
  { "name": "Rogue Crown", "desc": "Gain a Rogue Emblem, a Talon, and a Riven.", "tier": 3, "tierLabel": "Prismatic", "traits": ["Rogue"], "icon": "https://ap.tft.tools/static/augment-icons/new17_rogue_crown.svg" },
  { "name": "Challenger Heart", "desc": "Gain a Challenger Emblem and a Samira.", "tier": 1, "tierLabel": "Silver", "traits": ["Challenger"], "icon": "https://ap.tft.tools/static/augment-icons/new17_challenger_heart.svg" },
  { "name": "Challenger Crest", "desc": "Gain a Challenger Emblem and an Akali.", "tier": 2, "tierLabel": "Gold", "traits": ["Challenger"], "icon": "https://ap.tft.tools/static/augment-icons/new17_challenger_crest.svg" },
  { "name": "Channeler Heart", "desc": "Gain a Channeler Emblem and a Zoe.", "tier": 1, "tierLabel": "Silver", "traits": ["Channeler"], "icon": "https://ap.tft.tools/static/augment-icons/new17_channeler_heart.svg" },
  { "name": "Channeler Crown", "desc": "Gain a Channeler Emblem, a Viktor, and an Aurelion Sol.", "tier": 3, "tierLabel": "Prismatic", "traits": ["Channeler"], "icon": "https://ap.tft.tools/static/augment-icons/new17_channeler_crown.svg" },
  { "name": "Meeple Heart", "desc": "Gain a Meeple Emblem and a Poppy.", "tier": 1, "tierLabel": "Silver", "traits": ["Meeple"], "icon": "https://ap.tft.tools/static/augment-icons/new17_meeple_heart.svg" },
  { "name": "Meeple Crown", "desc": "Gain a Meeple Emblem, a Fizz, and a Bard.", "tier": 3, "tierLabel": "Prismatic", "traits": ["Meeple"], "icon": "https://ap.tft.tools/static/augment-icons/new17_meeple_crown.svg" },
  { "name": "Stargazer Heart", "desc": "Gain a Stargazer Emblem and a Talon.", "tier": 1, "tierLabel": "Silver", "traits": ["Stargazer"], "icon": "https://ap.tft.tools/static/augment-icons/new17_stargazer_heart.svg" },
  { "name": "Stargazer Crown", "desc": "Gain a Stargazer Emblem, a Jax, and a Nunu.", "tier": 3, "tierLabel": "Prismatic", "traits": ["Stargazer"], "icon": "https://ap.tft.tools/static/augment-icons/new17_stargazer_crown.svg" },
  { "name": "Space Groove Heart", "desc": "Gain a Space Groove Emblem and a Nasus.", "tier": 1, "tierLabel": "Silver", "traits": ["Space Groove"], "icon": "https://ap.tft.tools/static/augment-icons/new17_spacegroove_heart.svg" },
  { "name": "Space Groove Crown", "desc": "Gain a Space Groove Emblem, a Gwen, and a Blitzcrank.", "tier": 3, "tierLabel": "Prismatic", "traits": ["Space Groove"], "icon": "https://ap.tft.tools/static/augment-icons/new17_spacegroove_crown.svg" },
  { "name": "Tons of Stats!", "desc": "Your team gains 8 Armor, 8 Magic Resist, 8% Attack Speed, 8 Ability Power, and 8 Attack Damage.", "tier": 1, "tierLabel": "Silver", "traits": [], "icon": "https://ap.tft.tools/static/augment-icons/tons_of_stats.svg" },
  { "name": "Cybernetic Uplink", "desc": "At the start of each planning phase, gain 1 gold. Your team gains 150 Health and 15 Attack Damage.", "tier": 2, "tierLabel": "Gold", "traits": [], "icon": "https://ap.tft.tools/static/augment-icons/cybernetic_uplink.svg" },
  { "name": "Buried Treasures", "desc": "Gain 6 random component items.", "tier": 2, "tierLabel": "Gold", "traits": [], "icon": "https://ap.tft.tools/static/augment-icons/buried_treasures.svg" },
  { "name": "Pandora's Items", "desc": "Round Start: Randomize the items on your bench champions.", "tier": 1, "tierLabel": "Silver", "traits": [], "icon": "https://ap.tft.tools/static/augment-icons/pandoras_items.svg" },
  { "name": "Lategame Specialist", "desc": "You don't lose HP from losing combat. At Stage 4, gain 25 gold.", "tier": 3, "tierLabel": "Prismatic", "traits": [], "icon": "https://ap.tft.tools/static/augment-icons/lategame_specialist.svg" },
  { "name": "Anomaly Augment", "desc": "Gain a unique Anomaly that permanently upgrades one of your champions.", "tier": 3, "tierLabel": "Prismatic", "traits": [], "icon": "https://ap.tft.tools/static/augment-icons/anomaly.svg" },
  { "name": "Bastion Heart", "desc": "Gain a Bastion Emblem and an Aatrox.", "tier": 1, "tierLabel": "Silver", "traits": ["Bastion"], "icon": "https://ap.tft.tools/static/augment-icons/new17_bastion_heart.svg" },
  { "name": "Vanguard Heart", "desc": "Gain a Vanguard Emblem and a Poppy.", "tier": 1, "tierLabel": "Silver", "traits": ["Vanguard"], "icon": "https://ap.tft.tools/static/augment-icons/new17_vanguard_heart.svg" },
  { "name": "Sniper Heart", "desc": "Gain a Sniper Emblem and a Caitlyn.", "tier": 1, "tierLabel": "Silver", "traits": ["Sniper"], "icon": "https://ap.tft.tools/static/augment-icons/new17_sniper_heart.svg" }
]
```

- [ ] **Create `src/donut17/tabs/Augments.jsx`**:

```javascript
import React, { useState, useMemo } from "react";
import { C, F } from "../d17.js";
import augmentsData from "../data/augments.json";

var TIER_LABELS = { 1: "Silver", 2: "Gold", 3: "Prismatic" };
var TIER_COLOR  = { 1: "#a8a3be", 2: "#f0cc00", 3: "#c8b8ff" };
var TIER_BG     = { 1: "rgba(168,163,190,0.12)", 2: "rgba(240,204,0,0.12)", 3: "rgba(200,184,255,0.12)" };

function AugmentIcon({ icon, name }) {
  var [err, setErr] = useState(false);
  if (!err && icon) {
    return (
      <img
        src={icon}
        alt={name}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        onError={function() { setErr(true); }}
      />
    );
  }
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.textDim, fontFamily: F.label, fontWeight: 700 }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function Augments() {
  var [tierFilter, setTierFilter] = useState([]);
  var [traitFilter, setTraitFilter] = useState("all");
  var [search, setSearch] = useState("");

  var allTraits = useMemo(function() {
    var set = {};
    augmentsData.forEach(function(a) {
      (a.traits || []).forEach(function(t) { set[t] = true; });
    });
    return Object.keys(set).sort();
  }, []);

  var filtered = useMemo(function() {
    var q = search.toLowerCase().trim();
    return augmentsData.filter(function(a) {
      if (tierFilter.length > 0 && !tierFilter.includes(a.tier)) return false;
      if (traitFilter !== "all" && !(a.traits || []).includes(traitFilter)) return false;
      if (q && !a.name.toLowerCase().includes(q) && !a.desc.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tierFilter, traitFilter, search]);

  function toggleTier(t) {
    setTierFilter(function(prev) {
      return prev.includes(t) ? prev.filter(function(x) { return x !== t; }) : prev.concat([t]);
    });
  }

  return (
    <div>
      {/* Hero header */}
      <div style={{
        background: "linear-gradient(180deg, rgba(255,140,66,0.10) 0%, transparent 100%)",
        borderBottom: "1px solid " + C.border,
        padding: "32px 0 28px",
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, fontFamily: F.headline, fontWeight: 700, color: "#ff8c42", letterSpacing: 4, textTransform: "uppercase", marginBottom: 6, opacity: 0.85 }}>Set 17 · Space Gods</div>
        <h2 style={{ fontFamily: F.headline, fontWeight: 800, fontSize: 42, textTransform: "uppercase", letterSpacing: -1, color: C.text, lineHeight: 1, margin: "0 0 10px" }}>
          Augments
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 12, color: C.textDim, margin: 0 }}>
          {augmentsData.length} augments — Silver, Gold, Prismatic. Hover for full description.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[1, 2, 3].map(function(t) {
          var active = tierFilter.includes(t);
          return (
            <button
              key={t}
              onClick={function() { toggleTier(t); }}
              style={{
                padding: "5px 14px",
                background: active ? TIER_BG[t] : C.surface,
                border: "1px solid " + (active ? TIER_COLOR[t] + "55" : C.border),
                color: active ? TIER_COLOR[t] : C.textDim,
                fontFamily: F.headline, fontSize: 13, fontWeight: 700,
                letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {TIER_LABELS[t]}
            </button>
          );
        })}

        <select
          value={traitFilter}
          onChange={function(e) { setTraitFilter(e.target.value); }}
          style={{ background: C.surface, border: "1px solid " + C.border, color: C.textDim, padding: "5px 10px", fontFamily: F.label, fontSize: 12, cursor: "pointer" }}
        >
          <option value="all">All Traits</option>
          {allTraits.map(function(t) { return <option key={t} value={t}>{t}</option>; })}
        </select>

        <input
          placeholder="Search augments..."
          value={search}
          onChange={function(e) { setSearch(e.target.value); }}
          style={{ background: C.surface, border: "1px solid " + C.border, color: C.text, padding: "5px 12px", fontFamily: F.label, fontSize: 12, outline: "none", flex: 1, minWidth: 160 }}
        />

        {(tierFilter.length > 0 || traitFilter !== "all" || search) && (
          <button
            onClick={function() { setTierFilter([]); setTraitFilter("all"); setSearch(""); }}
            style={{ background: "transparent", border: "1px solid " + C.border, padding: "5px 12px", cursor: "pointer", fontFamily: F.label, fontSize: 11, color: C.textSub, letterSpacing: 1, textTransform: "uppercase" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Augment grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6 }}>
        {filtered.map(function(aug, idx) {
          var col = TIER_COLOR[aug.tier] || C.textDim;
          var bg  = TIER_BG[aug.tier]   || "transparent";
          return (
            <div
              key={idx}
              style={{
                background: C.surface,
                border: "1px solid " + C.border,
                borderTop: "2px solid " + col,
                padding: "12px 14px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={function(e) { e.currentTarget.style.borderColor = col + "88"; }}
              onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.borderTopColor = col; }}
            >
              {/* Icon */}
              <div style={{ width: 44, height: 44, flexShrink: 0, background: bg, border: "1px solid " + col + "44", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AugmentIcon icon={aug.icon} name={aug.name} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontFamily: F.headline, fontWeight: 700, fontSize: 14, color: C.text, textTransform: "uppercase", letterSpacing: 0.3 }}>{aug.name}</span>
                  <span style={{ fontSize: 9, padding: "1px 6px", background: bg, color: col, fontFamily: F.label, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", border: "1px solid " + col + "44", flexShrink: 0 }}>{aug.tierLabel}</span>
                </div>
                <p style={{ fontFamily: F.body, fontSize: 11, color: C.textDim, margin: 0, lineHeight: 1.5 }}>{aug.desc}</p>
                {aug.traits && aug.traits.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {aug.traits.map(function(t) {
                      return (
                        <span key={t} style={{ fontSize: 9, padding: "1px 6px", background: C.primary + "18", color: C.primary, fontFamily: F.label, fontWeight: 700, letterSpacing: 0.5, border: "1px solid " + C.primary + "33" }}>
                          {t}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Augments;
```

- [ ] **Build check**

```bash
cd C:/Users/gubje/Downloads/tft-clash && npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add src/donut17/data/augments.json src/donut17/tabs/Augments.jsx
git commit -m "feat: donut17 — new Augments tab with Set 17 data, tier + trait filters"
```

---

## Task 8: Redesign Remaining Tab Headers

**Files:**
- Modify: `src/donut17/tabs/OpenerAdvisor.jsx`
- Modify: `src/donut17/tabs/Items.jsx`
- Modify: `src/donut17/tabs/Gods.jsx`

All three get the same Galaxy Atlas hero header treatment — replace the old `<SectionHeader>` or centered title div with the new pattern.

- [ ] **Replace OpenerAdvisor's SectionHeader component** (the `function SectionHeader` defined inside the file) with this standalone function added near the top:

```javascript
function TabHero({ eyebrow, title, sub, accentColor }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, " + accentColor + "12 0%, transparent 100%)",
      borderBottom: "1px solid " + C.border,
      padding: "32px 0 28px",
      marginBottom: 24,
    }}>
      <div style={{ fontSize: 11, fontFamily: F.headline, fontWeight: 700, color: accentColor, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6, opacity: 0.85 }}>{eyebrow}</div>
      <h2 style={{ fontFamily: F.headline, fontWeight: 800, fontSize: 42, textTransform: "uppercase", letterSpacing: -1, color: C.text, lineHeight: 1, margin: "0 0 10px" }}>{title}</h2>
      {sub && <p style={{ fontFamily: F.body, fontSize: 12, color: C.textDim, margin: 0, maxWidth: 500 }}>{sub}</p>}
    </div>
  );
}
```

Then replace the existing header call at the top of the `OpenerAdvisor` render with:
```javascript
      <TabHero eyebrow="Set 17 · Space Gods" title="Opener Advisor" sub="Select your early game units — find which comp lines match your opener." accentColor={C.primary} />
```

- [ ] **Apply same `TabHero` pattern to `Items.jsx`** — add the `TabHero` function and replace the existing header with:

```javascript
      <TabHero eyebrow="Set 17 · Space Gods" title="Items" sub={filtered.length + " items — components, combined, artifacts, and emblems."} accentColor={C.secondary} />
```

- [ ] **Apply same `TabHero` pattern to `Gods.jsx`** — replace the existing centered header block with:

```javascript
      <TabHero eyebrow="Set 17 · Celestial Entities" title="Space Gods" sub="Choose one God each run. Blessings unlock at stages 2, 3, and 4." accentColor={C.tertiary} />
```

- [ ] **Build check**

```bash
cd C:/Users/gubje/Downloads/tft-clash && npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add src/donut17/tabs/OpenerAdvisor.jsx src/donut17/tabs/Items.jsx src/donut17/tabs/Gods.jsx
git commit -m "feat: donut17 — Galaxy Atlas hero headers on Opener, Items, Gods tabs"
```

---

## Task 9: Delete SynergyGrid Tab + Final Cleanup

**Files:**
- Delete: `src/donut17/tabs/SynergyGrid.jsx`

- [ ] **Delete the file**

```bash
rm C:/Users/gubje/Downloads/tft-clash/src/donut17/tabs/SynergyGrid.jsx
```

- [ ] **Verify no imports remain** — search for any leftover import:

```bash
grep -r "SynergyGrid" C:/Users/gubje/Downloads/tft-clash/src/
```
Expected: zero results (the import was already removed from Donut17Page.jsx in Task 2).

- [ ] **Full build + verify**

```bash
cd C:/Users/gubje/Downloads/tft-clash && npm run build 2>&1 | tail -10
```
Expected: Build succeeds with no errors.

- [ ] **Commit + push**

```bash
git add -A
git commit -m "feat: donut17 — complete Galaxy Atlas overhaul, drag-and-drop builder, augments tab"
git push origin master
```

---

## Self-Review

**Spec coverage check:**
- [x] Design system (d17.js tokens) — Task 1
- [x] Barlow Condensed font — Task 2
- [x] Tab restructure (remove Grid, add Augments) — Task 2
- [x] TeamBuilder drag-and-drop — Task 5
- [x] Comp Lines tier filter — Task 3 + 4
- [x] Champions synergy grid toggle — Task 6
- [x] Augments tab + data — Task 7
- [x] Hero headers on all tabs — Task 8
- [x] SynergyGrid deletion — Task 9

**Placeholder scan:** No TBDs found. All code blocks are complete.

**Type consistency:** `gDrag`, `handlePoolDragStart`, `handleBoardDragStart`, `handleHexDrop`, `handlePoolAreaDrop`, `handleDragEnd` — all defined in Task 5 and referenced consistently. `TIER_COLOR`/`TIER_BG` exported from d17.js in Task 1 and imported in Task 4.

**Note on augment icons:** The icon URLs in augments.json use a pattern (`ap.tft.tools/static/augment-icons/new17_*.svg`) that may not resolve — the `AugmentIcon` component has `onError` fallback to initials, so broken icons degrade gracefully.
