import React, { useState } from "react";
import { C, F, COST_COLOR } from "../d17.js";
import ChampIcon from "../components/ChampIcon.jsx";
import ItemIcon from "../components/ItemIcon.jsx";

const STRATEGY_COLOR = {
  "FAST 8":   "#8dcdff",
  "FAST 7":   "#8dcdff",
  "FAST 9":   "#8dcdff",
  "REROLL 6": "#cdbdff",
  "REROLL 7": "#cdbdff",
  "FLEX":     "#958da2",
};

function CompLines({ compLines, champions }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <h2 style={{ fontFamily: F.headline, fontSize: 24, fontWeight: 700, textTransform: "uppercase", letterSpacing: -0.5, color: C.text, borderLeft: "4px solid " + C.tertiary, paddingLeft: 12, margin: "0 0 6px" }}>
        Directives: Comp Lines
      </h2>
      <p style={{ fontFamily: F.body, fontSize: 12, color: C.textDim, marginBottom: 20, paddingLeft: 16 }}>
        10 theorycrafted comps — core board, BIS items, game plan, and recommended god.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {compLines.map(function(comp, idx) {
          const isExp = expanded === comp.id;
          const stratCol = STRATEGY_COLOR[comp.strategy] || C.borderLight;
          return (
            <div
              key={comp.id}
              style={{ background: isExp ? C.surface : C.surfaceLow, borderTop: "2px solid " + comp.color, position: "relative", transition: "background 0.15s" }}
            >
              <div
                style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
                onClick={function() { setExpanded(isExp ? null : comp.id); }}
              >
                {/* Rank number */}
                <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid " + C.border, flexShrink: 0 }}>
                  <span style={{ fontFamily: F.label, fontSize: 11, fontWeight: 700, color: C.textDim }}>{idx + 1}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: F.headline, fontSize: 16, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: -0.3 }}>{comp.name}</span>
                    <span style={{ fontSize: 10, padding: "1px 8px", background: comp.color + "22", color: comp.color, fontFamily: F.label, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", border: "1px solid " + comp.color + "44" }}>{comp.strategy}</span>
                    {comp.carry && (
                      <span style={{ fontSize: 10, color: C.textDim, fontFamily: F.label, letterSpacing: 1, textTransform: "uppercase" }}>
                        carry: <span style={{ color: comp.color }}>{(function() { const ch = champions.find(function(c) { return c.key === comp.carry; }); return ch ? ch.name : comp.carry; })()}</span>
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily: F.body, fontSize: 10, color: C.textDim, margin: 0 }}>{comp.desc}</p>
                </div>

                {/* Carry BIS items mini preview */}
                {comp.items && comp.carry && comp.items[comp.carry] && (
                  <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0, borderLeft: "1px solid " + C.border, paddingLeft: 10, marginLeft: 4 }}>
                    {comp.items[comp.carry].map(function(itemKey, ii) {
                      return <ItemIcon key={ii} itemKey={itemKey} size={24} />;
                    })}
                  </div>
                )}

                {/* Core portraits */}
                <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
                  {comp.core.map(function(key) {
                    const ch = champions.find(function(c) { return c.key === key; });
                    if (!ch) return null;
                    return (
                      <div key={key} style={{ position: "relative" }}>
                        <ChampIcon champ={ch} size={36} />
                        {key === comp.carry && (
                          <div style={{ position: "absolute", top: -3, right: -3, width: 10, height: 10, background: comp.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6, fontWeight: 900, fontFamily: F.label, color: "#000" }}>C</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <span style={{ color: C.textDim, fontSize: 11, flexShrink: 0 }}>{isExp ? "▲" : "▼"}</span>
              </div>

              {isExp && (
                <div style={{ borderTop: "1px solid " + C.border, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                  {/* Left: boards */}
                  <div style={{ padding: "16px", borderRight: "1px solid " + C.border }}>
                    <div style={{ fontSize: 11, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Core Board</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                      {comp.core.map(function(key) {
                        const ch = champions.find(function(c) { return c.key === key; });
                        if (!ch) return null;
                        return (
                          <div key={key} style={{ position: "relative" }}>
                            <ChampIcon champ={ch} size={48} showName={true} />
                            {key === comp.carry && (
                              <div style={{ position: "absolute", top: -4, right: -4, width: 13, height: 13, background: comp.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 900, fontFamily: F.label, color: "#000" }}>C</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {comp.flex && comp.flex.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Flex Units</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {comp.flex.map(function(key) {
                            const ch = champions.find(function(c) { return c.key === key; });
                            if (!ch) return null;
                            return <ChampIcon key={key} champ={ch} size={36} showName={true} />;
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: items + plan + god */}
                  <div style={{ padding: "16px" }}>
                    {comp.items && Object.keys(comp.items).length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>BIS Items</div>
                        {Object.entries(comp.items).map(function(entry) {
                          const champKey = entry[0];
                          const itemKeys = entry[1];
                          const ch = champions.find(function(c) { return c.key === champKey; });
                          return (
                            <div key={champKey} style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 11, fontFamily: F.label, color: comp.color, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                                {ch ? ch.name : champKey}
                              </div>
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                {itemKeys.map(function(itemKey, ii) {
                                  return <ItemIcon key={ii} itemKey={itemKey} size={36} showName={true} />;
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Tactical Plan</div>
                      <p style={{ fontSize: 11, fontFamily: F.body, color: C.textMuted, margin: 0, lineHeight: 1.7, background: C.surfaceLow, padding: "8px 10px" }}>
                        {comp.gameplan}
                      </p>
                    </div>

                    {comp.god && (
                      <div style={{ background: C.tertiary + "0d", border: "1px solid " + C.tertiary + "33", padding: "8px 10px" }}>
                        <div style={{ fontSize: 11, fontFamily: F.label, color: C.tertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Recommended God</div>
                        <div style={{ fontFamily: F.headline, fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{comp.god}</div>
                        {comp.godWhy && <div style={{ fontSize: 10, fontFamily: F.body, color: C.textDim }}>{comp.godWhy}</div>}
                      </div>
                    )}
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
