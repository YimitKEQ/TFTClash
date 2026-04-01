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
var TIER_LABEL_LONG = { S: "God-tier", A: "Strong", B: "Situational", C: "Off-meta" };

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
      {/* Hero */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: "linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(125,200,255,0.07) 60%, transparent 100%)",
        borderBottom: "1px solid " + C.border,
        padding: "56px 0 44px",
        marginBottom: 32,
      }}>
        <div style={{ position: "absolute", right: -80, top: -80, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,184,255,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: "60%", bottom: -40, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(125,200,255,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ fontSize: 11, fontFamily: F.headline, fontWeight: 700, color: C.tertiary, letterSpacing: 5, textTransform: "uppercase", marginBottom: 10 }}>Set 17 · Space Gods</div>
        <h2 style={{ fontFamily: F.headline, fontWeight: 900, fontSize: 72, textTransform: "uppercase", letterSpacing: -3, color: C.text, lineHeight: 0.88, margin: "0 0 18px" }}>
          Comp<br />Lines
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.textDim, margin: 0, maxWidth: 500, lineHeight: 1.6 }}>
          {compLines.length} theorycrafted comps — core boards, BIS items, game plans, god picks.
        </p>
      </div>

      {/* Tier filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28, flexWrap: "wrap", alignItems: "center" }}>
        {ALL_TIERS.map(function(t) {
          var active = tierFilter.includes(t);
          return (
            <button
              key={t}
              onClick={function() { toggleTier(t); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: active ? TIER_BG[t] : C.surface,
                border: "1px solid " + (active ? TIER_COLOR[t] : C.border),
                padding: "8px 18px 8px 8px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: 34, height: 34,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: active ? TIER_COLOR[t] : TIER_BG[t],
                fontFamily: F.headline, fontWeight: 900, fontSize: 20,
                color: active ? "#000" : TIER_COLOR[t],
              }}>{t}</div>
              <span style={{ fontFamily: F.headline, fontWeight: 700, fontSize: 14, letterSpacing: 1.5, textTransform: "uppercase", color: active ? C.text : C.textSub }}>
                {TIER_LABEL_LONG[t]}
              </span>
            </button>
          );
        })}
        {tierFilter.length > 0 && (
          <button
            onClick={function() { setTierFilter([]); }}
            style={{ background: "transparent", border: "1px solid " + C.border, padding: "8px 18px", cursor: "pointer", fontFamily: F.label, fontSize: 11, color: C.textSub, letterSpacing: 1.5, textTransform: "uppercase" }}
          >
            Show All
          </button>
        )}
      </div>

      {/* Comp grid — 2 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))", gap: 2 }}>
        {filtered.map(function(comp) {
          var isExp = expanded === comp.id;
          var tier = comp.tier || "C";
          var stratCol = STRATEGY_COLOR[comp.strategy] || C.borderLight;
          return (
            <div
              key={comp.id}
              style={{
                background: isExp ? C.surfaceHigh : C.surface,
                border: "1px solid " + (isExp ? comp.color + "66" : C.border),
                overflow: "hidden",
                transition: "all 0.15s",
                gridColumn: isExp ? "1 / -1" : "auto",
              }}
            >
              {/* Gradient splash header */}
              <div
                onClick={function() { setExpanded(isExp ? null : comp.id); }}
                style={{
                  height: 92,
                  background: "linear-gradient(135deg, " + comp.color + "35 0%, " + comp.color + "12 55%, " + C.surface + " 100%)",
                  borderBottom: "1px solid " + comp.color + "44",
                  padding: "0 16px 14px",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  position: "relative",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                {/* Glow orb */}
                <div style={{ position: "absolute", top: -30, left: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, " + comp.color + "25 0%, transparent 70%)", pointerEvents: "none" }} />
                {/* Tier badge */}
                <div style={{
                  position: "absolute", top: 14, right: 14,
                  background: TIER_COLOR[tier],
                  color: "#000",
                  fontFamily: F.headline, fontWeight: 900, fontSize: 11,
                  padding: "3px 10px",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}>
                  {tier} TIER
                </div>
                <div>
                  <h3 style={{ fontFamily: F.headline, fontWeight: 900, fontSize: 30, textTransform: "uppercase", letterSpacing: -0.5, color: C.text, lineHeight: 1, margin: "0 0 6px" }}>
                    {comp.name}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", background: stratCol + "22", color: stratCol, fontFamily: F.headline, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", border: "1px solid " + stratCol + "55" }}>{comp.strategy}</span>
                    <span style={{ fontSize: 11, color: C.textDim, fontFamily: F.body }}>{comp.desc}</span>
                  </div>
                </div>
                <div style={{ color: C.textSub, fontSize: 20, flexShrink: 0, transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.2s", paddingBottom: 4, marginLeft: 8 }}>▾</div>
              </div>

              {/* Body — champs + items */}
              <div style={{ padding: "14px 16px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 4, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                  {comp.core.map(function(key) {
                    var ch = champions.find(function(c) { return c.key === key; });
                    if (!ch) return null;
                    return (
                      <div key={key} style={{ position: "relative" }}>
                        <ChampIcon champ={ch} size={44} />
                        {key === comp.carry && (
                          <div style={{ position: "absolute", top: -3, right: -3, width: 13, height: 13, background: comp.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6, fontWeight: 900, fontFamily: F.label, color: "#000" }}>C</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {comp.items && comp.carry && comp.items[comp.carry] && (
                  <div style={{ display: "flex", gap: 3, alignItems: "center", borderLeft: "1px solid " + C.border, paddingLeft: 12, flexShrink: 0 }}>
                    {comp.items[comp.carry].map(function(itemKey, ii) {
                      return <ItemIcon key={ii} itemKey={itemKey} size={30} />;
                    })}
                  </div>
                )}
              </div>

              {/* Expanded detail */}
              {isExp && (
                <div style={{ borderTop: "1px solid " + C.border }}>
                  {/* Stage-by-stage game plan */}
                  {comp.stages && Object.keys(comp.stages).length > 0 && (
                    <div style={{ padding: "16px 16px 0" }}>
                      <div style={{ fontFamily: F.headline, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: comp.color, marginBottom: 12 }}>Stage-by-Stage Game Plan</div>
                      <div style={{ display: "flex", gap: 0, overflowX: "auto", marginBottom: 16 }}>
                        {[1, 2, 3, 4, 5].map(function(stageNum) {
                          var stage = comp.stages[String(stageNum)];
                          if (!stage) return null;
                          var isLast = stageNum === 5;
                          return (
                            <div
                              key={stageNum}
                              style={{
                                flex: 1,
                                minWidth: 160,
                                background: C.surface,
                                border: "1px solid " + comp.color + "33",
                                borderRight: isLast ? ("1px solid " + comp.color + "33") : "none",
                                padding: "12px",
                                position: "relative",
                              }}
                            >
                              {/* Stage number badge */}
                              <div style={{
                                width: 28, height: 28,
                                background: comp.color + "22",
                                border: "1px solid " + comp.color + "55",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontFamily: F.headline, fontWeight: 900, fontSize: 16,
                                color: comp.color,
                                marginBottom: 8,
                              }}>
                                {stageNum}
                              </div>
                              <div style={{ fontFamily: F.headline, fontSize: 11, fontWeight: 700, color: comp.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, lineHeight: 1.2 }}>
                                {stage.label || ("Stage " + stageNum)}
                              </div>
                              {/* Units for this stage */}
                              {stage.units && stage.units.length > 0 && (
                                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 8 }}>
                                  {stage.units.map(function(key) {
                                    var ch = champions.find(function(c) { return c.key === key; });
                                    if (!ch) return null;
                                    return <ChampIcon key={key} champ={ch} size={28} />;
                                  })}
                                </div>
                              )}
                              <p style={{ fontFamily: F.body, fontSize: 10, color: C.textDim, margin: 0, lineHeight: 1.6 }}>
                                {stage.tip}
                              </p>
                              {/* Arrow connector */}
                              {!isLast && (
                                <div style={{
                                  position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)",
                                  width: 0, height: 0,
                                  borderTop: "8px solid transparent",
                                  borderBottom: "8px solid transparent",
                                  borderLeft: "10px solid " + comp.color + "55",
                                  zIndex: 2,
                                }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bottom detail: God Pick + Flex + Items */}
                  <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
                    <div>
                      <div style={{ fontFamily: F.headline, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: comp.color, marginBottom: 10 }}>God Pick</div>
                      <div style={{ fontFamily: F.headline, fontSize: 20, fontWeight: 800, color: C.tertiary, marginBottom: 6 }}>{comp.god}</div>
                      <p style={{ fontFamily: F.body, fontSize: 11, color: C.textDim, margin: 0, lineHeight: 1.5 }}>{comp.godWhy}</p>
                    </div>
                    {comp.flex && comp.flex.length > 0 && (
                      <div>
                        <div style={{ fontFamily: F.headline, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: comp.color, marginBottom: 10 }}>Flex Units</div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {comp.flex.map(function(key) {
                            var ch = champions.find(function(c) { return c.key === key; });
                            if (!ch) return null;
                            return <ChampIcon key={key} champ={ch} size={38} />;
                          })}
                        </div>
                      </div>
                    )}
                    {comp.items && Object.keys(comp.items).filter(function(k) { return k !== comp.carry; }).length > 0 && (
                      <div>
                        <div style={{ fontFamily: F.headline, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: comp.color, marginBottom: 10 }}>Secondary Items</div>
                        {Object.entries(comp.items).filter(function(entry) { return entry[0] !== comp.carry; }).map(function(entry) {
                          var key = entry[0];
                          var itemList = entry[1];
                          var ch = champions.find(function(c) { return c.key === key; });
                          return (
                            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              {ch && <ChampIcon champ={ch} size={28} />}
                              <div style={{ display: "flex", gap: 3 }}>
                                {itemList.map(function(itemKey, ii) { return <ItemIcon key={ii} itemKey={itemKey} size={24} />; })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div>
                      <div style={{ fontFamily: F.headline, fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: comp.color, marginBottom: 10 }}>Overview</div>
                      <p style={{ fontFamily: F.body, fontSize: 12, color: C.textMuted, lineHeight: 1.7, margin: 0 }}>{comp.gameplan}</p>
                    </div>
                  </div>
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
