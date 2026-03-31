import React, { useState } from "react";
import ChampIcon from "../components/ChampIcon.jsx";

function CompLines({ compLines, champions }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      <h2 style={{ fontFamily: "'Orbitron', monospace", fontSize: 16, color: "#a78bfa", margin: "0 0 6px", fontWeight: 700, letterSpacing: 1 }}>
        COMP LINES
      </h2>
      <p style={{ fontSize: 11, color: "#475569", fontFamily: "'Chakra Petch', sans-serif", margin: "0 0 16px" }}>
        10 theorycrafted comps with carries, items, and stage-by-stage game plans.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {compLines.map(function(comp) {
          const isExp = expanded === comp.id;
          return (
            <div
              key={comp.id}
              style={{ border: "1px solid " + (isExp ? comp.color : "#1e293b"), borderRadius: 10, overflow: "hidden", background: "rgba(8,12,24,0.7)", boxShadow: isExp ? ("0 0 16px " + comp.color + "22") : "none", transition: "all 0.2s" }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer" }}
                onClick={function() { setExpanded(isExp ? null : comp.id); }}
              >
                <div style={{ width: 5, height: 42, borderRadius: 3, background: comp.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 14, color: comp.color, fontWeight: 900, letterSpacing: 0.5, marginBottom: 3 }}>
                    {comp.name.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'Chakra Petch', sans-serif" }}>
                    {comp.desc}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                  {comp.core.slice(0, 5).map(function(key) {
                    const ch = champions.find(function(c) { return c.key === key; });
                    if (!ch) return null;
                    return <ChampIcon key={key} champ={ch} size={34} />;
                  })}
                  {comp.core.length > 5 && (
                    <div style={{ width: 34, height: 34, borderRadius: 6, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#64748b", border: "1px solid #1e293b" }}>
                      +{comp.core.length - 5}
                    </div>
                  )}
                </div>
                <span style={{ color: "#475569", fontSize: 12 }}>{isExp ? "▲" : "▼"}</span>
              </div>

              {isExp && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div>
                      <SectionLabel text="CORE BOARD" color={comp.color} />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {comp.core.map(function(key) {
                          const ch = champions.find(function(c) { return c.key === key; });
                          if (!ch) return null;
                          const isCarry = key === comp.carry;
                          return (
                            <div key={key} style={{ position: "relative" }}>
                              <ChampIcon champ={ch} size={44} showName={true} />
                              {isCarry && (
                                <div style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: comp.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#000", fontWeight: 900, fontFamily: "'Chakra Petch', sans-serif" }}>
                                  C
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <SectionLabel text="FLEX UNITS" color="#475569" />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {(comp.flex || []).map(function(key) {
                          const ch = champions.find(function(c) { return c.key === key; });
                          if (!ch) return null;
                          return <ChampIcon key={key} champ={ch} size={36} showName={true} />;
                        })}
                        {(!comp.flex || comp.flex.length === 0) && (
                          <span style={{ fontSize: 11, color: "#475569", fontFamily: "'Chakra Petch', sans-serif" }}>Situational</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {comp.items && Object.keys(comp.items).length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <SectionLabel text="BIS ITEMS" color={comp.color} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {Object.entries(comp.items).map(function([role, items]) {
                          return items.map(function(item, i) {
                            return (
                              <div key={role + i} style={{ fontSize: 11, color: "#cbd5e1", fontFamily: "'Chakra Petch', sans-serif", padding: "4px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 5, borderLeft: "3px solid " + comp.color + "66" }}>
                                {item}
                              </div>
                            );
                          });
                        })}
                      </div>
                    </div>
                  )}

                  {comp.gameplan && (
                    <div style={{ marginBottom: 14 }}>
                      <SectionLabel text="GAME PLAN" color={comp.color} />
                      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "'Chakra Petch', sans-serif", lineHeight: 1.7, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                        {comp.gameplan}
                      </div>
                    </div>
                  )}

                  {comp.god && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(167,139,250,0.05)", borderRadius: 6, border: "1px solid rgba(167,139,250,0.15)" }}>
                      <span style={{ fontSize: 10, color: "#475569", fontFamily: "'Chakra Petch', sans-serif" }}>Recommended God</span>
                      <span style={{ fontSize: 13, color: "#a78bfa", fontWeight: 700, fontFamily: "'Orbitron', monospace" }}>{comp.god.toUpperCase()}</span>
                      {comp.godWhy && (
                        <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'Chakra Petch', sans-serif" }}>
                          - {comp.godWhy}
                        </span>
                      )}
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

function SectionLabel({ text, color }) {
  return (
    <div style={{ fontSize: 9, color: color, fontFamily: "'Orbitron', monospace", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>
      {text}
    </div>
  );
}

export default CompLines;
