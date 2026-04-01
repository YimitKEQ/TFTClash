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

function TierLabel(t) {
  if (t === "S") return "God-tier";
  if (t === "A") return "Strong";
  if (t === "B") return "Situational";
  return "Off-meta";
}

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
          {compLines.length} theorycrafted compositions. Core board, BIS items, game plan, god pick.
        </p>
      </div>

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
                {TierLabel(t)}
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

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {filtered.map(function(comp) {
          var isExp = expanded === comp.id;
          var tier = comp.tier || "C";
          var stratCol = STRATEGY_COLOR[comp.strategy] || C.borderLight;
          return (
            <div key={comp.id} style={{ background: isExp ? C.surface : C.surfaceLow, border: "1px solid " + (isExp ? C.borderLight : C.border), overflow: "hidden", transition: "background 0.15s" }}>
              <div style={{ height: 4, background: "linear-gradient(90deg, " + comp.color + ", " + comp.color + "44)" }} />
              <div
                style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                onClick={function() { setExpanded(isExp ? null : comp.id); }}
              >
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
                {comp.items && comp.carry && comp.items[comp.carry] && (
                  <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0, borderLeft: "1px solid " + C.border, paddingLeft: 12 }}>
                    {comp.items[comp.carry].map(function(itemKey, ii) {
                      return <ItemIcon key={ii} itemKey={itemKey} size={26} />;
                    })}
                  </div>
                )}
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
                <div style={{ color: C.textSub, fontSize: 16, flexShrink: 0, transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▾</div>
              </div>
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
