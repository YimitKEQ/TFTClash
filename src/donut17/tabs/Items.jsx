import React, { useState, useMemo } from "react";
import { C, F } from "../d17.js";
import itemsData from "../data/items_clean.json";

const CATEGORY_ORDER = ["component", "combined", "artifact", "emblem", "set17"];
const CATEGORY_LABELS = {
  component: "Components",
  combined:  "Combined Items",
  artifact:  "Artifacts",
  emblem:    "Trait Emblems",
  set17:     "Set 17 Special",
};
const CATEGORY_COLOR = {
  component: "#8dcdff",
  combined:  "#cdbdff",
  artifact:  "#f59e0b",
  emblem:    "#ec4899",
  set17:     "#4ade80",
};
const TAG_COLOR = {
  ad:        "#e9c400",
  ap:        "#cdbdff",
  tank:      "#8dcdff",
  utility:   "#4ade80",
  artifact:  "#f59e0b",
  emblem:    "#ec4899",
  set17:     "#4ade80",
  special:   "#958da2",
  component: "#8dcdff",
  combined:  "#cdbdff",
};

function primaryTag(item) {
  const tags = item.tags || [];
  for (let i = 0; i < tags.length; i++) {
    if (TAG_COLOR[tags[i]]) return tags[i];
  }
  return item.category || "component";
}

// Standalone recipe component icon — avoids hooks-in-map
function RecipeIcon({ rk }) {
  const [err, setErr] = useState(false);
  const rItem = itemsData.find(function(x) { return x.key === rk; });
  return (
    <div
      title={rItem ? rItem.name : rk}
      style={{ width: 20, height: 20, border: "1px solid " + C.border, background: C.surfaceHighest, overflow: "hidden", flexShrink: 0 }}
    >
      {!err && rItem && rItem.icon ? (
        <img src={rItem.icon} alt={rItem ? rItem.name : rk} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={function() { setErr(true); }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: C.surfaceHigh, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6, color: C.textDim, fontFamily: F.label, fontWeight: 700 }}>
          {(rItem ? rItem.name : rk).slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

// Standalone component grid tile — avoids hooks-in-map
function ComponentTile({ item, expanded, onToggle }) {
  const [err, setErr] = useState(false);
  const col = TAG_COLOR[primaryTag(item)] || "#494456";
  return (
    <div
      onClick={onToggle}
      title={item.name}
      style={{
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        width: 64,
      }}
    >
      <div style={{
        width: 52, height: 52,
        border: "2px solid " + (expanded ? col : col + "44"),
        background: expanded ? col + "18" : C.surfaceLow,
        overflow: "hidden",
        transition: "all 0.1s",
      }}>
        {!err && item.icon ? (
          <img src={item.icon} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function() { setErr(true); }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: col + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: col, fontFamily: F.label, fontWeight: 700 }}>
            {item.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <span style={{ fontSize: 9, fontFamily: F.label, color: expanded ? col : C.textDim, textAlign: "center", lineHeight: 1.2, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {item.name}
      </span>
    </div>
  );
}

function ComponentDetailPanel({ items, expanded }) {
  const item = items.find(function(x) { return x.key === expanded; });
  if (!item) return null;
  const col = TAG_COLOR[primaryTag(item)] || "#494456";
  return (
    <div style={{ background: C.surface, border: "1px solid " + col + "44", borderLeft: "3px solid " + col, padding: "12px 16px" }}>
      <div style={{ fontFamily: F.headline, fontSize: 16, fontWeight: 700, color: col, textTransform: "uppercase", letterSpacing: -0.3, marginBottom: 4 }}>{item.name}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {(item.tags || []).map(function(t) {
          const tc = TAG_COLOR[t] || "#494456";
          return (
            <span key={t} style={{ fontSize: 10, background: tc + "18", color: tc, padding: "1px 6px", fontFamily: F.label, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{t}</span>
          );
        })}
      </div>
      {item.desc && <p style={{ fontFamily: F.body, fontSize: 11, color: C.textDim, margin: 0, lineHeight: 1.6 }}>{item.desc}</p>}
    </div>
  );
}

function ComponentGrid({ items, expanded, setExpanded }) {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        {items.map(function(item) {
          return (
            <ComponentTile
              key={item.key}
              item={item}
              expanded={expanded === item.key}
              onToggle={function() { setExpanded(expanded === item.key ? null : item.key); }}
            />
          );
        })}
      </div>
      {expanded && <ComponentDetailPanel items={items} expanded={expanded} />}
    </div>
  );
}

function ItemCard({ item, expanded, onToggle }) {
  const [err, setErr] = useState(false);
  const col = TAG_COLOR[primaryTag(item)] || "#494456";

  return (
    <div
      onClick={onToggle}
      style={{
        cursor: "pointer",
        background: expanded ? C.surface : C.surfaceLow,
        borderTop: "2px solid " + col,
        transition: "background 0.1s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
        {/* Icon */}
        <div style={{ width: 40, height: 40, flexShrink: 0, border: "1px solid " + col + "44", background: C.surfaceHigh, overflow: "hidden" }}>
          {!err && item.icon ? (
            <img
              src={item.icon}
              alt={item.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={function() { setErr(true); }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: col + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: col, fontFamily: F.label, fontWeight: 700 }}>
              {(item.acronym || item.name).slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.headline, fontSize: 11, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>
            {item.name}
            {item.acronym && (
              <span style={{ fontFamily: F.label, fontSize: 10, color: C.textDim, marginLeft: 5, letterSpacing: 1 }}>({item.acronym})</span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {(item.tags || []).slice(0, 4).map(function(t) {
              const tc = TAG_COLOR[t] || "#494456";
              return (
                <span key={t} style={{ fontSize: 9, background: tc + "18", color: tc, padding: "1px 6px", fontFamily: F.label, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{t}</span>
              );
            })}
          </div>
        </div>

        {/* Recipe mini icons */}
        {item.recipe && item.recipe.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
            {item.recipe.map(function(rk, ri) {
              return <RecipeIcon key={ri + "_" + rk} rk={rk} />;
            })}
          </div>
        )}
      </div>

      {expanded && item.desc && (
        <div style={{ padding: "6px 10px 10px", borderTop: "1px solid " + C.border + "44" }}>
          <p style={{ fontFamily: F.body, fontSize: 10, color: C.textDim, margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
        </div>
      )}
    </div>
  );
}

function TabHero({ eyebrow, title, sub, accentColor }) {
  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(160deg, " + accentColor + "18 0%, " + accentColor + "05 60%, transparent 100%)",
      borderBottom: "1px solid " + C.border,
      padding: "52px 0 40px",
      marginBottom: 32,
    }}>
      <div style={{ position: "absolute", right: -60, top: -60, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, " + accentColor + "12 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ fontSize: 11, fontFamily: F.headline, fontWeight: 700, color: accentColor, letterSpacing: 5, textTransform: "uppercase", marginBottom: 10 }}>{eyebrow}</div>
      <h2 style={{ fontFamily: F.headline, fontWeight: 900, fontSize: 72, textTransform: "uppercase", letterSpacing: -3, color: C.text, lineHeight: 0.88, margin: "0 0 18px" }}>{title}</h2>
      {sub && <p style={{ fontFamily: F.body, fontSize: 13, color: C.textDim, margin: 0, maxWidth: 520, lineHeight: 1.6 }}>{sub}</p>}
    </div>
  );
}

function RecipeResult({ item }) {
  const [err, setErr] = useState(false);
  const col = TAG_COLOR[primaryTag(item)] || "#494456";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: C.surface, border: "1px solid " + col + "44",
      borderLeft: "3px solid " + col,
      padding: "8px 10px",
    }}>
      <div style={{ width: 36, height: 36, flexShrink: 0, border: "1px solid " + col + "55", background: C.surfaceHigh, overflow: "hidden" }}>
        {!err && item.icon ? (
          <img src={item.icon} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={function() { setErr(true); }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: col + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: col, fontFamily: F.label, fontWeight: 700 }}>
            {(item.acronym || item.name).slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F.headline, fontSize: 12, fontWeight: 700, color: col, textTransform: "uppercase", letterSpacing: 0.3 }}>{item.name}</div>
        {item.desc && <div style={{ fontFamily: F.body, fontSize: 10, color: C.textDim, lineHeight: 1.4, marginTop: 2 }}>{item.desc.slice(0, 80)}{item.desc.length > 80 ? "..." : ""}</div>}
      </div>
    </div>
  );
}

function RecipeBuilder() {
  const components = itemsData.filter(function(x) { return x.category === "component"; });
  const combined   = itemsData.filter(function(x) { return x.category === "combined"; });
  const [slot1, setSlot1] = useState(null);
  const [slot2, setSlot2] = useState(null);

  const results = useMemo(function() {
    if (!slot1 && !slot2) return [];
    return combined.filter(function(item) {
      if (!item.recipe || item.recipe.length < 2) return false;
      if (slot1 && slot2) {
        return (item.recipe[0] === slot1 && item.recipe[1] === slot2) ||
               (item.recipe[0] === slot2 && item.recipe[1] === slot1);
      }
      const picked = slot1 || slot2;
      return item.recipe.includes(picked);
    });
  }, [slot1, slot2, combined]);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ height: 1, width: 20, background: C.secondary + "66" }} />
        <span style={{ fontFamily: F.headline, fontSize: 10, fontWeight: 700, color: C.secondary, letterSpacing: 3, textTransform: "uppercase" }}>Recipe Finder</span>
      </div>
      <div style={{ background: C.surfaceLow, border: "1px solid " + C.border, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontFamily: F.body, fontSize: 11, color: C.textDim, marginBottom: 12 }}>
          Pick up to 2 components to see what you can craft.
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          {[slot1, slot2].map(function(slotKey, si) {
            const comp = slotKey ? itemsData.find(function(x) { return x.key === slotKey; }) : null;
            const col = C.secondary;
            return (
              <div
                key={si}
                onClick={function() { if (si === 0) setSlot1(null); else setSlot2(null); }}
                style={{
                  width: 52, height: 52,
                  border: "2px solid " + (comp ? col + "88" : C.border),
                  background: comp ? col + "12" : C.surfaceHigh,
                  overflow: "hidden",
                  cursor: comp ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
                title={comp ? comp.name + " (click to remove)" : ("Slot " + (si + 1))}
              >
                {comp && comp.icon ? (
                  <img src={comp.icon} alt={comp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 22, color: C.border }}>+</span>
                )}
              </div>
            );
          })}
          <span style={{ fontSize: 18, color: C.textSub }}>+</span>
          <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {components.map(function(comp) {
              const active = slot1 === comp.key || slot2 === comp.key;
              return (
                <div
                  key={comp.key}
                  title={comp.name}
                  onClick={function() {
                    if (active) {
                      if (slot1 === comp.key) setSlot1(null);
                      else setSlot2(null);
                    } else if (!slot1) {
                      setSlot1(comp.key);
                    } else if (!slot2) {
                      setSlot2(comp.key);
                    }
                  }}
                  style={{
                    width: 28, height: 28,
                    border: "1px solid " + (active ? C.secondary + "88" : C.border),
                    background: active ? C.secondary + "22" : C.surfaceHighest,
                    overflow: "hidden", cursor: "pointer", flexShrink: 0,
                    outline: active ? ("2px solid " + C.secondary + "55") : "none",
                    outlineOffset: 1,
                  }}
                >
                  {comp.icon ? (
                    <img src={comp.icon} alt={comp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {results.length > 0 && (
        <div>
          <div style={{ fontFamily: F.label, fontSize: 10, color: C.textSub, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
            {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 4 }}>
            {results.map(function(item) {
              return <RecipeResult key={item.key} item={item} />;
            })}
          </div>
        </div>
      )}
      {(slot1 || slot2) && results.length === 0 && (
        <div style={{ fontFamily: F.label, fontSize: 11, color: C.textSub, textAlign: "center", padding: "20px 0", letterSpacing: 1 }}>
          No combined items found for this combination.
        </div>
      )}
    </div>
  );
}

function Items() {
  const [category, setCategory] = useState("combined");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(function() {
    const q = search.toLowerCase().trim();
    return itemsData.filter(function(item) {
      if (item.category !== category) return false;
      if (!q) return true;
      if (item.name.toLowerCase().includes(q)) return true;
      if (item.acronym && item.acronym.toLowerCase().includes(q)) return true;
      if ((item.tags || []).some(function(t) { return t.toLowerCase().includes(q); })) return true;
      return false;
    });
  }, [category, search]);

  return (
    <div>
      <TabHero eyebrow="Set 17 · Space Gods" title="Items" sub="Components, combined items, artifacts, and emblems." accentColor={C.secondary} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {CATEGORY_ORDER.map(function(cat) {
          const active = category === cat;
          const col = CATEGORY_COLOR[cat];
          const count = itemsData.filter(function(x) { return x.category === cat; }).length;
          return (
            <button
              key={cat}
              onClick={function() { setCategory(cat); setExpanded(null); }}
              style={{
                padding: "5px 12px",
                background: active ? col + "22" : "transparent",
                border: "1px solid " + (active ? col : C.border),
                color: active ? col : C.textDim,
                fontFamily: F.label,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.1s",
              }}
            >
              {CATEGORY_LABELS[cat]} <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          );
        })}
        <input
          value={search}
          onChange={function(e) { setSearch(e.target.value); }}
          placeholder="Search..."
          style={{
            marginLeft: "auto",
            padding: "5px 10px",
            background: C.surfaceLow,
            border: "1px solid " + C.border,
            color: C.text,
            fontSize: 11,
            fontFamily: F.label,
            outline: "none",
            width: 140,
          }}
        />
      </div>

      {category === "component" && <RecipeBuilder />}

      {category === "component" ? (
        <ComponentGrid items={filtered} expanded={expanded} setExpanded={setExpanded} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 }}>
          {filtered.map(function(item) {
            return (
              <ItemCard
                key={item.key}
                item={item}
                expanded={expanded === item.key}
                onToggle={function() { setExpanded(expanded === item.key ? null : item.key); }}
              />
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: C.textDim, fontFamily: F.label, fontSize: 11, letterSpacing: 1 }}>
          NO ITEMS FOUND
        </div>
      )}
    </div>
  );
}

export default Items;
