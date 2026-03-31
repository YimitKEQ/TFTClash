import React, { useState, useMemo } from "react";
import ChampIcon from "../components/ChampIcon.jsx";

const TYPE_COLORS = { origin: "#a78bfa", class: "#60a5fa", unique: "#f59e0b" };
const COST_COLORS = { 1: "#9ca3af", 2: "#22c55e", 3: "#3b82f6", 4: "#a855f7", 5: "#eab308" };

function SynergyGrid({ champions, traits }) {
  const [hoverTrait, setHoverTrait] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);

  const origins = useMemo(function() {
    return traits.filter(function(t) { return t.type === "origin"; }).sort(function(a, b) { return a.name.localeCompare(b.name); });
  }, [traits]);

  const classes = useMemo(function() {
    return traits.filter(function(t) { return t.type === "class"; }).sort(function(a, b) { return a.name.localeCompare(b.name); });
  }, [traits]);

  const uniqueTraits = useMemo(function() {
    return traits.filter(function(t) { return t.type === "unique"; }).sort(function(a, b) { return a.name.localeCompare(b.name); });
  }, [traits]);

  const champMap = useMemo(function() {
    const m = {};
    champions.forEach(function(c) { m[c.key] = c; });
    return m;
  }, [champions]);

  // Build grid: for each origin x class pair, which champs have both?
  const grid = useMemo(function() {
    const g = {};
    origins.forEach(function(o) {
      g[o.name] = {};
      classes.forEach(function(cl) {
        const champs = champions.filter(function(c) {
          return c.traits.includes(o.name) && c.traits.includes(cl.name);
        });
        g[o.name][cl.name] = champs;
      });
    });
    return g;
  }, [origins, classes, champions]);

  // For each trait, all its champions
  const traitChamps = useMemo(function() {
    const m = {};
    traits.forEach(function(t) {
      m[t.name] = champions.filter(function(c) { return c.traits.includes(t.name); });
    });
    return m;
  }, [traits, champions]);

  const cellKey = selectedCell ? selectedCell.origin + "|" + selectedCell.cls : null;
  const cellChamps = cellKey && grid[selectedCell.origin] ? grid[selectedCell.origin][selectedCell.cls] : [];

  return (
    <div>
      <h2 style={{ fontFamily: "'Orbitron', monospace", fontSize: 16, color: "#a78bfa", margin: "0 0 6px", fontWeight: 700, letterSpacing: 1 }}>
        SYNERGY GRID
      </h2>
      <p style={{ fontSize: 11, color: "#475569", fontFamily: "'Chakra Petch', sans-serif", margin: "0 0 14px" }}>
        Origin (rows) x Class (columns). Click any cell to see shared champions.
      </p>

      <div style={{ overflowX: "auto", marginBottom: 24 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: 100, padding: "6px 8px", textAlign: "left", fontSize: 9, color: "#475569", fontFamily: "'Orbitron', monospace", letterSpacing: 0.5, borderBottom: "1px solid #1e293b" }}>
                ORIGIN / CLASS
              </th>
              {classes.map(function(cl) {
                const isHov = hoverTrait === cl.name;
                return (
                  <th
                    key={cl.name}
                    style={{ padding: "4px 4px", textAlign: "center", fontSize: 9, color: isHov ? "#60a5fa" : "#64748b", fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, borderBottom: "1px solid #1e293b", cursor: "pointer", background: isHov ? "rgba(96,165,250,0.05)" : "transparent", transition: "all 0.1s", minWidth: 60 }}
                    onMouseEnter={function() { setHoverTrait(cl.name); }}
                    onMouseLeave={function() { setHoverTrait(null); }}
                  >
                    {cl.name}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {origins.map(function(origin) {
              const isHovRow = hoverTrait === origin.name;
              return (
                <tr key={origin.name}>
                  <td
                    style={{ padding: "4px 8px", fontSize: 10, color: isHovRow ? "#a78bfa" : "#94a3b8", fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", background: isHovRow ? "rgba(167,139,250,0.05)" : "transparent", whiteSpace: "nowrap" }}
                    onMouseEnter={function() { setHoverTrait(origin.name); }}
                    onMouseLeave={function() { setHoverTrait(null); }}
                  >
                    {origin.name}
                  </td>
                  {classes.map(function(cl) {
                    const champs = grid[origin.name] ? grid[origin.name][cl.name] : [];
                    const isSelCell = selectedCell && selectedCell.origin === origin.name && selectedCell.cls === cl.name;
                    const isHighlighted = hoverTrait === origin.name || hoverTrait === cl.name;
                    return (
                      <td
                        key={cl.name}
                        style={{ padding: "3px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", background: isSelCell ? "rgba(167,139,250,0.1)" : isHighlighted ? "rgba(255,255,255,0.03)" : "transparent", cursor: champs.length > 0 ? "pointer" : "default" }}
                        onClick={function() {
                          if (champs.length === 0) return;
                          if (isSelCell) { setSelectedCell(null); return; }
                          setSelectedCell({ origin: origin.name, cls: cl.name });
                        }}
                      >
                        {champs.length > 0 && (
                          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 1 }}>
                            {champs.slice(0, 3).map(function(ch) {
                              return (
                                <div key={ch.key} style={{ width: 18, height: 18, borderRadius: 3, overflow: "hidden", border: "1px solid " + COST_COLORS[ch.cost] + "88" }}>
                                  {ch.assets && ch.assets.face && (
                                    <img
                                      src={ch.assets.face}
                                      alt={ch.name}
                                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                      onError={function(e) { e.target.style.opacity = "0"; }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                            {champs.length > 3 && (
                              <div style={{ width: 18, height: 18, borderRadius: 3, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#94a3b8" }}>
                                +{champs.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedCell && cellChamps.length > 0 && (
        <div style={{ marginBottom: 24, padding: "12px 14px", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 8, background: "rgba(167,139,250,0.05)" }}>
          <div style={{ fontSize: 11, color: "#a78bfa", fontFamily: "'Orbitron', monospace", letterSpacing: 1, marginBottom: 8 }}>
            {selectedCell.origin.toUpperCase()} + {selectedCell.cls.toUpperCase()}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {cellChamps.map(function(ch) {
              return (
                <div key={ch.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ChampIcon champ={ch} size={36} showName={true} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, color: "#a78bfa", fontFamily: "'Orbitron', monospace", letterSpacing: 1, marginBottom: 10 }}>ORIGINS</div>
          {origins.map(function(t) {
            return <TraitLegend key={t.name} trait={t} champList={traitChamps[t.name] || []} />;
          })}
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#60a5fa", fontFamily: "'Orbitron', monospace", letterSpacing: 1, marginBottom: 10 }}>CLASSES</div>
          {classes.map(function(t) {
            return <TraitLegend key={t.name} trait={t} champList={traitChamps[t.name] || []} />;
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, color: "#f59e0b", fontFamily: "'Orbitron', monospace", letterSpacing: 1, marginBottom: 10 }}>UNIQUE / HERO TRAITS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {uniqueTraits.map(function(t) {
            const champs = traitChamps[t.name] || [];
            return (
              <div key={t.name} style={{ padding: "6px 10px", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, background: "rgba(245,158,11,0.05)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700 }}>{t.name}</span>
                {champs.map(function(ch) {
                  return <ChampIcon key={ch.key} champ={ch} size={24} />;
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TraitLegend({ trait, champList }) {
  const [open, setOpen] = useState(false);
  const color = TYPE_COLORS[trait.type] || "#94a3b8";
  const breakpoints = trait.effects ? trait.effects.map(function(e) { return e.minUnits; }).filter(Boolean) : [];

  return (
    <div style={{ marginBottom: 6, borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", cursor: "pointer", background: "rgba(255,255,255,0.02)" }}
        onClick={function() { setOpen(function(v) { return !v; }); }}
      >
        <span style={{ fontSize: 11, color: color, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, flex: 1 }}>{trait.name}</span>
        <div style={{ display: "flex", gap: 2 }}>
          {breakpoints.map(function(bp, i) {
            return (
              <span key={i} style={{ fontSize: 9, padding: "0 4px", borderRadius: 3, background: color + "22", color: color, fontFamily: "'JetBrains Mono', monospace" }}>{bp}</span>
            );
          })}
        </div>
        <span style={{ color: "#475569", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {trait.desc && (
            <p style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'Chakra Petch', sans-serif", margin: "0 0 6px", lineHeight: 1.5 }}>
              {trait.desc}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {champList.map(function(ch) {
              return <ChampIcon key={ch.key} champ={ch} size={28} showName={true} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SynergyGrid;
