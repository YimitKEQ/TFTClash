# Donut17 UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Donut17 page from a cluttered, hard-to-read companion app into a polished, pro-level TFT guide with the visual quality of MetaTFT/TFTactics.

**Architecture:** Inline styles using design tokens from `d17.js`. Progressive disclosure via expand/collapse state. Shared components (`ChampIcon`, `ItemIcon`, `TraitBadge`, `Tooltip`) updated first, then each tab rebuilt in order of complexity. No new dependencies needed.

**Tech Stack:** React 18, inline styles via `d17.js` tokens, existing data JSON files, tft.tools + CommunityDragon CDN for assets.

**CRITICAL CODE RULES (from CLAUDE.md):**
- Use `var` declarations, `function(){}` callbacks - NO arrow functions, NO IIFEs in JSX
- No backtick string literals inside JS functions
- No named function components defined inside another component's body (define at module level)

---

## File Structure

### Modified files:
| File | Lines | Responsibility |
|------|-------|----------------|
| `src/donut17/d17.js` | 68 | Design tokens - colors, fonts, cost/tier/augment/item maps |
| `src/donut17/Donut17Page.jsx` | 195 | Layout shell - top nav bar, tab routing, footer |
| `src/donut17/components/ChampIcon.jsx` | 57 | Reusable champion portrait with cost-color border + gradient |
| `src/donut17/components/ItemIcon.jsx` | 84 | Reusable item icon with type-color coding |
| `src/donut17/components/TraitBadge.jsx` | 36 | Reusable trait pill with colored dot + count |
| `src/donut17/tabs/CompLines.jsx` | 301 | Comp browser with tier filter, expand/collapse cards |
| `src/donut17/tabs/Champions.jsx` | 269 | Champion browser with cost filter, expandable detail |
| `src/donut17/tabs/Items.jsx` | 460 | Item browser with recipe builder, category tabs |
| `src/donut17/tabs/Augments.jsx` | 303 | Augment browser with tier selector, trait filter |
| `src/donut17/tabs/OpenerAdvisor.jsx` | 399 | Opener helper with champion picker + comp matching |
| `src/donut17/tabs/TeamBuilder.jsx` | 1020 | Hex board builder with drag-and-drop |
| `src/donut17/tabs/Gods.jsx` | 144 | God browser with detail card |

### New files:
| File | Responsibility |
|------|----------------|
| `src/donut17/components/Tooltip.jsx` | Shared hover tooltip with 200ms delay |

---

## Task 1: Update Design Tokens (d17.js)

**Files:**
- Modify: `src/donut17/d17.js`

This is the foundation - all other tasks depend on these tokens.

- [ ] **Step 1: Replace the entire d17.js with updated tokens**

```js
// Donut17 design tokens — UI Overhaul v4

export var C = {
  bg:              '#080611',
  surface:         '#110e1c',
  surfaceLow:      '#0d0b17',
  surfaceHigh:     '#1a1628',
  surfaceHighest:  '#221d34',
  border:          '#1e1a30',
  borderHover:     '#2e2848',
  borderLight:     '#3d3660',
  primary:         '#c8b8ff',
  primaryDim:      '#9b8fcc',
  secondary:       '#7dc8ff',
  secondaryDim:    '#5ea0cc',
  tertiary:        '#f0cc00',
  tertiaryDim:     '#b89e00',
  orange:          '#ff8c42',
  text:            '#eceef8',
  textSecondary:   '#a8a3be',
  textMuted:       '#8a85a0',
  textDim:         '#6b6585',
  textGhost:       '#4a4565',
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
  2: '#4ade80',
  3: '#60a5fa',
  4: '#c084fc',
  5: '#facc15',
};

export var COST_BORDER = {
  1: '#6b7280',
  2: '#22c55e',
  3: '#3b82f6',
  4: '#a855f7',
  5: '#eab308',
};

export var COST_BG_TOP = {
  1: '#1f2937',
  2: '#0a2e14',
  3: '#0c1e3e',
  4: '#1e0a3a',
  5: '#2a2000',
};

export var COST_BG_BOT = {
  1: '#111827',
  2: '#0a1a10',
  3: '#0a1428',
  4: '#140a28',
  5: '#1a1400',
};

export var COST_GLOW = {
  1: 'rgba(107,114,128,0.25)',
  2: 'rgba(34,197,94,0.3)',
  3: 'rgba(59,130,246,0.3)',
  4: 'rgba(168,85,247,0.35)',
  5: 'rgba(234,179,8,0.4)',
};

export var TRAIT_COLOR = {
  origin: '#c8b8ff',
  class:  '#7dc8ff',
  unique: '#f0cc00',
};

export var TIER_GRADIENT = {
  S: 'linear-gradient(135deg, #c9a21a, #8a6d00)',
  A: 'linear-gradient(135deg, #9b6dff, #6a3fbf)',
  B: 'linear-gradient(135deg, #4a90e8, #2d6bc4)',
  C: 'linear-gradient(135deg, #3dba6e, #2a8a50)',
};

export var TIER_GLOW = {
  S: '#c9a21a30',
  A: '#9b6dff30',
  B: '#4a90e830',
  C: '#3dba6e30',
};

export var TIER_COLOR = {
  S: '#f0cc00',
  A: '#c084fc',
  B: '#60a5fa',
  C: '#4ade80',
};

export var TIER_BG = {
  S: 'rgba(240,204,0,0.12)',
  A: 'rgba(192,132,252,0.12)',
  B: 'rgba(96,165,250,0.12)',
  C: 'rgba(74,222,128,0.12)',
};

export var AUG_COLOR = {
  1: '#c0c0c0',
  2: '#f0cc00',
  3: '#e879f9',
};

export var ITEM_TYPE_COLOR = {
  ad:       '#f87171',
  ap:       '#a78bfa',
  tank:     '#4ade80',
  utility:  '#7dc8ff',
  artifact: '#f0cc00',
  emblem:   '#ec4899',
};

export var STAT_COLOR = {
  hp:          'linear-gradient(90deg, #4ade80, #22c55e)',
  damage:      'linear-gradient(90deg, #f87171, #ef4444)',
  attackSpeed: 'linear-gradient(90deg, #facc15, #eab308)',
  armor:       'linear-gradient(90deg, #fb923c, #f97316)',
  magicResist: 'linear-gradient(90deg, #a78bfa, #8b5cf6)',
  range:       'linear-gradient(90deg, #67e8f9, #06b6d4)',
};
```

- [ ] **Step 2: Verify the app still loads**

Run: `npm run dev` and open the donut17 page. It will look slightly different because some token names changed (e.g., `textMuted` shifted meaning). That's expected - we fix each file in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/donut17/d17.js
git commit -m "feat(donut17): update design tokens for UI overhaul"
```

---

## Task 2: Create Tooltip Component

**Files:**
- Create: `src/donut17/components/Tooltip.jsx`

- [ ] **Step 1: Create the Tooltip component**

```jsx
import React, { useState, useRef } from "react";
import { C, F } from "../d17.js";

function Tooltip({ text, children, style: extra }) {
  var ref = useRef(null);
  var timerRef = useRef(null);
  var [show, setShow] = useState(false);
  var [pos, setPos] = useState({ top: 0, left: 0 });

  function onEnter(e) {
    var rect = e.currentTarget.getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    timerRef.current = setTimeout(function() { setShow(true); }, 200);
  }

  function onLeave() {
    clearTimeout(timerRef.current);
    setShow(false);
  }

  if (!text) return children;

  return React.createElement("span", {
    ref: ref,
    onMouseEnter: onEnter,
    onMouseLeave: onLeave,
    style: Object.assign({ position: "relative", display: "inline-flex" }, extra || {}),
  },
    children,
    show && React.createElement("div", {
      style: {
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: "translate(-50%, -100%)",
        background: C.surfaceHighest,
        border: "1px solid " + C.borderHover,
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 11,
        fontFamily: F.body,
        color: C.text,
        whiteSpace: "nowrap",
        zIndex: 9999,
        pointerEvents: "none",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        maxWidth: 280,
      }
    }, text)
  );
}

export default Tooltip;
```

- [ ] **Step 2: Commit**

```bash
git add src/donut17/components/Tooltip.jsx
git commit -m "feat(donut17): add shared Tooltip component"
```

---

## Task 3: Update ChampIcon Component

**Files:**
- Modify: `src/donut17/components/ChampIcon.jsx`

- [ ] **Step 1: Rewrite ChampIcon with new design**

Replace the entire file content:

```jsx
import React, { useState } from "react";
import { COST_COLOR, COST_BORDER, COST_BG_TOP, COST_BG_BOT, C, F } from "../d17.js";
import Tooltip from "./Tooltip.jsx";

function ChampIcon({ champ, size, showName, selected, onClick, overlay, showCost, showCarry }) {
  var sz = size || 44;
  var ref = useState(false);
  var err = ref[0];
  var setErr = ref[1];
  var color = COST_COLOR[champ.cost] || C.borderLight;
  var border = COST_BORDER[champ.cost] || C.borderLight;
  var bgTop = COST_BG_TOP[champ.cost] || C.surfaceHigh;
  var bgBot = COST_BG_BOT[champ.cost] || C.surfaceHigh;
  var radius = Math.round(sz * 0.22);
  var src = champ.assets ? (sz >= 48 ? champ.assets.face_lg : champ.assets.face) : "";

  var tooltipText = champ.name + (champ.cost ? " (" + champ.cost + " gold)" : "");

  return React.createElement(Tooltip, { text: tooltipText },
    React.createElement("div", {
      style: { display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }
    },
      React.createElement("div", {
        onClick: onClick,
        style: {
          width: sz,
          height: sz,
          borderRadius: radius,
          border: "2px solid " + (selected ? color : border),
          background: "linear-gradient(180deg, " + bgTop + " 0%, " + bgBot + " 100%)",
          overflow: "hidden",
          cursor: onClick ? "pointer" : "default",
          position: "relative",
          flexShrink: 0,
          transition: "transform 0.15s, border-color 0.15s",
          outline: selected ? ("2px solid " + color + "55") : "none",
          outlineOffset: 2,
        },
        onMouseEnter: function(e) { if (onClick) e.currentTarget.style.transform = "scale(1.12)"; },
        onMouseLeave: function(e) { e.currentTarget.style.transform = "scale(1)"; },
      },
        src && !err
          ? React.createElement("img", {
              src: src,
              alt: champ.name,
              style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
              onError: function() { setErr(true); },
            })
          : React.createElement("div", {
              style: {
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: Math.max(10, sz * 0.24),
                fontFamily: F.body,
                fontWeight: 700,
                color: color,
              }
            }, champ.name ? champ.name.slice(0, 3) : "?"),
        showCarry && React.createElement("div", {
          style: {
            position: "absolute", top: -5, right: -5,
            background: "linear-gradient(135deg, #c8b8ff, #9b8adf)",
            color: C.bg,
            fontSize: 7, fontWeight: 800,
            padding: "2px 5px",
            borderRadius: 4,
            letterSpacing: 0.5,
            lineHeight: 1,
            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
          }
        }, "CARRY"),
        showCost && React.createElement("div", {
          style: {
            position: "absolute", bottom: -3, right: -3,
            fontSize: 9, fontWeight: 800,
            padding: "1px 5px",
            borderRadius: 4,
            color: C.bg,
            background: color,
          }
        }, champ.cost),
        overlay && React.createElement("div", {
          style: {
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "rgba(0,0,0,0.75)",
            fontSize: 10, color: color,
            fontFamily: F.body,
            textAlign: "center",
            padding: "1px 0",
            fontWeight: 700,
            borderRadius: "0 0 " + radius + "px " + radius + "px",
          }
        }, overlay)
      ),
      showName && React.createElement("span", {
        style: {
          fontSize: 10, color: C.textSecondary,
          fontFamily: F.body,
          textAlign: "center",
          lineHeight: 1,
          maxWidth: sz + 8,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }
      }, champ.name)
    )
  );
}

export default ChampIcon;
```

- [ ] **Step 2: Verify ChampIcon renders on any tab that uses it**

Open the donut17 page and check the Comps tab - champion icons should now have rounded corners, gradient fills, and cost-colored borders.

- [ ] **Step 3: Commit**

```bash
git add src/donut17/components/ChampIcon.jsx
git commit -m "feat(donut17): redesign ChampIcon with cost gradients and rounded corners"
```

---

## Task 4: Update ItemIcon Component

**Files:**
- Modify: `src/donut17/components/ItemIcon.jsx`

- [ ] **Step 1: Rewrite ItemIcon with new design**

Replace the entire file content:

```jsx
import React, { useState } from "react";
import { C, F, ITEM_TYPE_COLOR } from "../d17.js";
import itemsData from "../data/items_clean.json";
import Tooltip from "./Tooltip.jsx";

var ITEM_MAP = {};
itemsData.forEach(function(item) { ITEM_MAP[item.key] = item; });

function getItemColor(item) {
  if (!item || !item.tags) return C.borderLight;
  var tags = item.tags;
  if (tags.includes("ad")) return ITEM_TYPE_COLOR.ad;
  if (tags.includes("ap")) return ITEM_TYPE_COLOR.ap;
  if (tags.includes("tank")) return ITEM_TYPE_COLOR.tank;
  if (tags.includes("utility")) return ITEM_TYPE_COLOR.utility;
  if (tags.includes("artifact")) return ITEM_TYPE_COLOR.artifact;
  if (tags.includes("emblem")) return ITEM_TYPE_COLOR.emblem;
  return C.borderLight;
}

function ItemIcon({ itemKey, size, showName, style: extra }) {
  var item = ITEM_MAP[itemKey] || { name: itemKey, icon: "", key: itemKey, tags: [] };
  var sz = size || 28;
  var ref = useState(false);
  var err = ref[0];
  var setErr = ref[1];
  var color = getItemColor(item);

  return React.createElement(Tooltip, { text: item.name + (item.desc ? " - " + item.desc.replace(/<[^>]*>/g, "").slice(0, 80) : "") },
    React.createElement("div", {
      style: Object.assign({
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        flexShrink: 0,
      }, extra || {})
    },
      React.createElement("div", {
        style: {
          width: sz, height: sz,
          borderRadius: Math.round(sz * 0.2),
          border: "1px solid " + color + "55",
          background: color + "10",
          overflow: "hidden",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }
      },
        !err && item.icon
          ? React.createElement("img", {
              src: item.icon,
              alt: item.name,
              style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
              onError: function() { setErr(true); },
            })
          : React.createElement("div", {
              style: {
                fontSize: Math.max(9, sz * 0.3),
                color: color,
                fontFamily: F.body,
                fontWeight: 700,
              }
            }, (item.acronym || item.name || "").slice(0, 2).toUpperCase())
      ),
      showName && React.createElement("span", {
        style: {
          fontSize: 9,
          fontFamily: F.label,
          color: C.textSecondary,
          textAlign: "center",
          maxWidth: sz + 8,
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }
      }, item.acronym || item.name)
    )
  );
}

export { ITEM_MAP };
export default ItemIcon;
```

- [ ] **Step 2: Commit**

```bash
git add src/donut17/components/ItemIcon.jsx
git commit -m "feat(donut17): redesign ItemIcon with type-color coding and tooltips"
```

---

## Task 5: Update TraitBadge Component

**Files:**
- Modify: `src/donut17/components/TraitBadge.jsx`

- [ ] **Step 1: Rewrite TraitBadge as colored pill**

Replace the entire file content:

```jsx
import React from "react";
import { TRAIT_COLOR, C, F } from "../d17.js";

function TraitBadge({ trait, count, showCount, compact }) {
  var color = TRAIT_COLOR[trait.type] || C.borderLight;
  var ct = count || 0;

  return React.createElement("span", {
    title: trait.desc ? trait.desc.replace(/<[^>]*>/g, "").slice(0, 120) : trait.name,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: compact ? 4 : 5,
      padding: compact ? "2px 8px" : "4px 12px",
      borderRadius: 6,
      background: color + "10",
      border: "1px solid " + color + "30",
      fontSize: compact ? 10 : 11,
      fontFamily: F.body,
      fontWeight: 500,
      color: color,
      whiteSpace: "nowrap",
    }
  },
    React.createElement("span", {
      style: {
        width: compact ? 4 : 5,
        height: compact ? 4 : 5,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }
    }),
    trait.name,
    showCount && ct > 0 && React.createElement("strong", {
      style: { fontWeight: 700 }
    }, ct)
  );
}

export default TraitBadge;
```

- [ ] **Step 2: Commit**

```bash
git add src/donut17/components/TraitBadge.jsx
git commit -m "feat(donut17): redesign TraitBadge as colored pill with dot indicator"
```

---

## Task 6: Redesign Donut17Page Layout

**Files:**
- Modify: `src/donut17/Donut17Page.jsx`

This removes the left sidebar and updates the top nav to match the spec mockup.

- [ ] **Step 1: Rewrite Donut17Page.jsx**

Replace the entire file content:

```jsx
import React, { useState, useEffect } from "react";
import { C, F } from "./d17.js";
import championsData from "./data/champions.json";
import traitsData from "./data/traits.json";
import godsData from "./data/gods.json";
import compLinesData from "./data/comp_lines.json";

import OpenerAdvisor from "./tabs/OpenerAdvisor.jsx";
import Augments from "./tabs/Augments.jsx";
import Champions from "./tabs/Champions.jsx";
import CompLines from "./tabs/CompLines.jsx";
import Gods from "./tabs/Gods.jsx";
import Items from "./tabs/Items.jsx";
import TeamBuilder from "./tabs/TeamBuilder.jsx";

var TABS = [
  { id: "opener",   label: "Opener",    icon: "grid_view" },
  { id: "builder",  label: "Builder",   icon: "dashboard" },
  { id: "comps",    label: "Comps",     icon: "bar_chart" },
  { id: "champs",   label: "Champions", icon: "group" },
  { id: "items",    label: "Items",     icon: "shield" },
  { id: "augments", label: "Augments",  icon: "auto_awesome" },
  { id: "gods",     label: "Gods",      icon: "military_tech" },
];

function MSIcon(props) {
  return React.createElement("span", {
    className: "material-symbols-outlined",
    style: { fontSize: props.size || 20, lineHeight: 1, display: "inline-block" },
  }, props.name);
}

function Donut17Page() {
  var tabState = useState("opener");
  var tab = tabState[0];
  var setTab = tabState[1];

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

  return React.createElement("div", {
    style: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: F.body }
  },
    // Cosmic background
    React.createElement("div", {
      style: {
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 800px 600px at 20% 20%, #1a0a3a22 0%, transparent 70%), radial-gradient(ellipse 600px 400px at 80% 60%, #0a1a3a22 0%, transparent 70%), " + C.bg,
      }
    }),
    // Sticky top bar
    React.createElement("header", {
      style: {
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(8,6,17,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid " + C.border,
        padding: "0 24px",
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 20,
      }
    },
      // Brand
      React.createElement("div", {
        style: {
          fontFamily: F.headline,
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: 1,
          background: "linear-gradient(135deg, #c8b8ff, #7dc8ff)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textTransform: "uppercase",
          flexShrink: 0,
        }
      }, "Donut 17"),
      // Set badge
      React.createElement("div", {
        style: {
          fontSize: 11, color: C.textDim,
          border: "1px solid " + C.borderHover,
          padding: "3px 10px",
          borderRadius: 12,
          letterSpacing: 0.5,
          flexShrink: 0,
        }
      }, "Set 17 - Space Gods"),
      // Tab nav
      React.createElement("nav", {
        style: { display: "flex", gap: 2, marginLeft: "auto", height: 52 }
      },
        TABS.map(function(t) {
          var active = tab === t.id;
          return React.createElement("button", {
            key: t.id,
            onClick: function() { setTab(t.id); },
            style: {
              padding: "0 16px",
              height: "100%",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              color: active ? C.text : C.textDim,
              cursor: "pointer",
              border: "none",
              background: "none",
              position: "relative",
              fontFamily: F.body,
              letterSpacing: 0.3,
              transition: "color 0.2s",
            }
          },
            React.createElement(MSIcon, { name: t.icon, size: 16 }),
            t.label,
            active && React.createElement("div", {
              style: {
                position: "absolute", bottom: 0, left: 12, right: 12,
                height: 2,
                background: "linear-gradient(90deg, #c8b8ff, #7dc8ff)",
                borderRadius: 2,
              }
            })
          );
        })
      )
    ),
    // Main content - NO sidebar, full width
    React.createElement("main", {
      style: {
        position: "relative", zIndex: 1,
        maxWidth: 1100,
        margin: "0 auto",
        padding: "24px 20px 60px",
      }
    },
      React.createElement(React.Suspense, { fallback: null },
        tab === "opener"   && React.createElement(OpenerAdvisor, { champions: championsData, traits: traitsData, compLines: compLinesData }),
        tab === "builder"  && React.createElement(TeamBuilder, { champions: championsData, traits: traitsData }),
        tab === "augments" && React.createElement(Augments, null),
        tab === "champs"   && React.createElement(Champions, { champions: championsData, traits: traitsData }),
        tab === "comps"    && React.createElement(CompLines, { compLines: compLinesData, champions: championsData }),
        tab === "items"    && React.createElement(Items, null),
        tab === "gods"     && React.createElement(Gods, { gods: godsData })
      ),
      // Footer
      React.createElement("footer", {
        style: {
          marginTop: 48,
          borderTop: "1px solid " + C.border,
          padding: "16px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }
      },
        React.createElement("span", {
          style: { fontFamily: F.headline, fontWeight: 700, fontSize: 12, color: C.borderHover, letterSpacing: 2, textTransform: "uppercase" }
        }, "DONUT17"),
        React.createElement("span", {
          style: { fontFamily: F.label, fontSize: 9, color: C.borderHover, letterSpacing: 1, textTransform: "uppercase" }
        }, "v17 PBE - for the homies only - not affiliated with riot")
      )
    )
  );
}

export default Donut17Page;
```

- [ ] **Step 2: Verify layout**

Run the dev server. The page should now have:
- Sticky top bar with gradient brand text, set badge, and tab buttons
- NO left sidebar
- Full-width content area (maxWidth 1100px, centered)
- Gradient underline on active tab

- [ ] **Step 3: Commit**

```bash
git add src/donut17/Donut17Page.jsx
git commit -m "feat(donut17): redesign layout - remove sidebar, new top nav"
```

---

## Task 7: Redesign CompLines Tab

**Files:**
- Modify: `src/donut17/tabs/CompLines.jsx`

This is the most visible tab and the primary showcase of the new design. Follow the mockup from the brainstorm session exactly.

- [ ] **Step 1: Rewrite CompLines.jsx**

This is a full rewrite. The file will be approximately 350 lines. Key changes from current:
- Hero section: smaller, cleaner (28px title instead of 72px)
- Tier filter chips with glow effects instead of plain toggles
- Comp cards with 48px tier badge, 44px champion icons, CARRY badge, BIS items, trait pills
- Expand/collapse with stage timeline, god section, flex units
- Minimum 11px fonts throughout

Read the current `src/donut17/tabs/CompLines.jsx` for the data shape and state management, then rewrite using the new design tokens and patterns from the mockup.

The key data props are `compLines` (array) and `champions` (array). Each comp has: `id`, `name`, `tier`, `strategy`, `desc`, `core` (array of champ keys), `carry` (champ key), `items` (object keyed by champ key), `god`, `godWhy`, `stages` (object keyed by stage number), `flex` (array of champ keys), `color`.

Champion lookup: `var champMap = {}; champions.forEach(function(c) { champMap[c.key] = c; });`

Structure the component as:
1. Module-level helpers: `TabHero`, `CompCard`, `StageTimeline`, `GodSection`
2. Main `CompLines` function with filter state and rendering

**IMPORTANT:** Every function component must be defined at module level, NOT inside another component.

- [ ] **Step 2: Verify CompLines renders correctly**

Check that:
- Tier filter chips toggle correctly
- Comp cards show champion icons with correct cost colors
- Expand/collapse works
- Stage timeline renders horizontally
- No text smaller than 11px

- [ ] **Step 3: Commit**

```bash
git add src/donut17/tabs/CompLines.jsx
git commit -m "feat(donut17): full CompLines tab redesign"
```

---

## Task 8: Redesign Champions Tab

**Files:**
- Modify: `src/donut17/tabs/Champions.jsx`

- [ ] **Step 1: Rewrite Champions.jsx**

Key changes:
- Cost filter chips (1-5) with cost colors and glow on active
- Cards view: auto-fill grid (minmax 280px), 56px portrait with cost badge
- Expanded card spans full width: stat bars (3-col grid), ability section, BIS items, "Appears In" comps
- Synergy grid view: champions grouped by trait with larger icons (36px instead of 28px)

Structure:
1. Module-level: `StatBar`, `ChampCard`, `ChampDetail`, `SynergyGrid`
2. Main `Champions` function

Use `STAT_COLOR` from d17.js for stat bar gradients. Stat max values: HP: 2000, damage: 100, attackSpeed: 1.2, armor: 100, magicResist: 100, range: 7.

- [ ] **Step 2: Verify and commit**

```bash
git add src/donut17/tabs/Champions.jsx
git commit -m "feat(donut17): full Champions tab redesign"
```

---

## Task 9: Redesign Items Tab

**Files:**
- Modify: `src/donut17/tabs/Items.jsx`

- [ ] **Step 1: Rewrite Items.jsx**

Key changes:
- Category tabs with accent-color active state
- Recipe Builder: centered card with 52px drop slots, plus, equals, 56px result with glow
- Component grid: 5-column with 36px icons
- Combined items: row layout with 40px type-colored icon, name, tags, recipe mini-icons
- All item icons use `ItemIcon` component (which now has tooltips)

Structure:
1. Module-level: `RecipeBuilder`, `ComponentGrid`, `CombinedItemRow`
2. Main `Items` function

- [ ] **Step 2: Verify and commit**

```bash
git add src/donut17/tabs/Items.jsx
git commit -m "feat(donut17): full Items tab redesign"
```

---

## Task 10: Redesign Augments Tab

**Files:**
- Modify: `src/donut17/tabs/Augments.jsx`

- [ ] **Step 1: Rewrite Augments.jsx**

Key changes:
- Tier selector: three side-by-side cards (Silver/Gold/Prismatic) with diamond icon, label, count
- Active tier: brighter border + glow + tinted background
- Trait filter pills: horizontal, "All" default, orange accent on active
- Augment cards: left accent stripe (3px), 44px icon with tier-colored fill, expand for full desc + "Works Well With"

Use `AUG_COLOR` from d17.js for tier coloring.

Structure:
1. Module-level: `TierSelector`, `AugCard`
2. Main `Augments` function

- [ ] **Step 2: Verify and commit**

```bash
git add src/donut17/tabs/Augments.jsx
git commit -m "feat(donut17): full Augments tab redesign"
```

---

## Task 11: Redesign OpenerAdvisor Tab

**Files:**
- Modify: `src/donut17/tabs/OpenerAdvisor.jsx`

- [ ] **Step 1: Rewrite OpenerAdvisor.jsx**

Key changes:
- Champion picker: grouped by cost with cost-colored section headers, 40px icons
- Selected units bar above picker with remove (X) on each
- Trait display: pills with breakpoint dots (filled for active, empty for remaining)
- Comp recommendations: same card style as CompLines but with match percentage badge
- "BEST" badge subtle (not overwhelming)

Reuse `ChampIcon` and `TraitBadge` components. The comp card format should mirror the CompLines card layout for consistency.

- [ ] **Step 2: Verify and commit**

```bash
git add src/donut17/tabs/OpenerAdvisor.jsx
git commit -m "feat(donut17): full OpenerAdvisor tab redesign"
```

---

## Task 12: Redesign Gods Tab

**Files:**
- Modify: `src/donut17/tabs/Gods.jsx`

- [ ] **Step 1: Rewrite Gods.jsx**

Key changes:
- God grid: 120x90 portrait cards with gradient overlay and name at bottom (not tiny thumbnails)
- Selected: accent border + glow
- Detail card: 200px portrait, name/title, blessing section (dark card), stage offerings (3-column grid), related comps as pills, tip text

Structure:
1. Module-level: `GodPortrait`, `GodDetailCard`
2. Main `Gods` function

- [ ] **Step 2: Verify and commit**

```bash
git add src/donut17/tabs/Gods.jsx
git commit -m "feat(donut17): full Gods tab redesign"
```

---

## Task 13: Redesign TeamBuilder Tab

**Files:**
- Modify: `src/donut17/tabs/TeamBuilder.jsx`

This is the largest file (1020 lines) and most complex tab. Take extra care with the drag-and-drop state.

- [ ] **Step 1: Rewrite TeamBuilder.jsx**

Key changes:
- Hex board: 52px hexagons with cost-colored borders on placed champions, dashed border on empty
- Item slots: 3 small circles below each hex
- Star level: 1-3 stars above hex
- Champion pool: right panel with search + cost filter, 40px draggable tiles
- Trait sidebar: left panel, TraitBadge with breakpoint indicator (bronze/silver/gold/chromatic)
- Item picker: tab panel (Combined/Components/Artifacts), 34px grid
- Drag feedback: scale(1.1) + shadow

Preserve the existing drag-and-drop logic (module-level `gDrag` variable pattern) but update all the visual rendering.

**IMPORTANT:** This file has significant logic (drag/drop, undo/redo, item assignment, trait calculation). Read the entire current file before rewriting. Only change the visual layer - keep all the state management and logic intact.

Structure:
1. Module-level: `BoardHex`, `PoolChampTile`, `TraitSidebar`, `ItemPicker`, `ItemPickerIcon`
2. Main `TeamBuilder` function

- [ ] **Step 2: Test all interactions**

Verify:
- Drag champion from pool to board works
- Drag between board hexes works
- Item assignment works
- Star level toggle works
- Undo/redo works
- Trait sidebar updates correctly

- [ ] **Step 3: Commit**

```bash
git add src/donut17/tabs/TeamBuilder.jsx
git commit -m "feat(donut17): full TeamBuilder tab redesign"
```

---

## Task 14: Fix Text References to Old Token Names

**Files:**
- All files in `src/donut17/`

After all tabs are rewritten, some may still reference old token names like `C.textMuted` (which was renamed to `C.textSecondary` in Task 1) or `C.textDim` (which shifted meaning).

- [ ] **Step 1: Search for any broken token references**

Run: `grep -rn "C\.textMuted\|C\.textSub\|C\.borderLight\|COST_GLOW" src/donut17/`

Fix any remaining references to old token names.

- [ ] **Step 2: Verify full app loads without errors**

Run: `npm run dev` and click through every tab. Check browser console for errors.

- [ ] **Step 3: Commit**

```bash
git add -A src/donut17/
git commit -m "fix(donut17): fix remaining token reference mismatches"
```

---

## Task 15: Final Visual QA Pass

**Files:**
- Any files that need tweaks

- [ ] **Step 1: Check every tab against the design spec**

For each tab, verify:
- No text smaller than 11px
- All champion icons use cost-color borders + gradient fills
- All items have type-color coding
- Trait pills use new colored-dot style
- Tooltips appear on champion icons, item icons, trait badges
- Expand/collapse works on all cards
- Hero sections use the correct gradient + typography

- [ ] **Step 2: Fix any visual issues found**

- [ ] **Step 3: Final commit**

```bash
git add -A src/donut17/
git commit -m "feat(donut17): complete UI/UX overhaul - all tabs redesigned"
```
