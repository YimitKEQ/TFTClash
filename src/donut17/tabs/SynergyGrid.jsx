import React, { useState, useMemo } from "react";
import { C, F, COST_COLOR, TRAIT_COLOR } from "../d17.js";
import ChampIcon from "../components/ChampIcon.jsx";

function SynergyGrid({ champions, traits }) {
  const [selectedCell, setSelectedCell] = useState(null);
  const [hoverRow, setHoverRow] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);
  const [openTrait, setOpenTrait] = useState(null);

  const origins = useMemo(function() {
    return traits.filter(function(t) { return t.type === "origin"; }).sort(function(a, b) { return a.name.localeCompare(b.name); });
  }, [traits]);

  const classes = useMemo(function() {
    return traits.filter(function(t) { return t.type === "class"; }).sort(function(a, b) { return a.name.localeCompare(b.name); });
  }, [traits]);

  const uniques = useMemo(function() {
    return traits.filter(function(t) { return t.type === "unique"; });
  }, [traits]);

  const grid = useMemo(function() {
    const g = {};
    origins.forEach(function(o) {
      g[o.name] = {};
      classes.forEach(function(cl) {
        g[o.name][cl.name] = champions.filter(function(c) {
          return c.traits.includes(o.name) && c.traits.includes(cl.name);
        });
      });
    });
    return g;
  }, [origins, classes, champions]);

  const traitChamps = useMemo(function() {
    const m = {};
    traits.forEach(function(t) {
      m[t.name] = champions.filter(function(c) { return c.traits.includes(t.name); });
    });
    return m;
  }, [traits, champions]);

  const cellChamps = selectedCell && grid[selectedCell.o] ? (grid[selectedCell.o][selectedCell.c] || []) : [];

  return (
    <div>
      <h2 style={{ fontFamily: F.headline, fontSize: 24, fontWeight: 700, textTransform: "uppercase", letterSpacing: -0.5, color: C.text, borderLeft: "4px solid " + C.secondary, paddingLeft: 12, margin: "0 0 6px" }}>
        Synergy Grid
      </h2>
      <p style={{ fontFamily: F.body, fontSize: 12, color: C.textDim, marginBottom: 20, paddingLeft: 16 }}>
        Origins (rows) x Classes (columns) — click any cell to inspect.
      </p>

      <div style={{ overflowX: "auto", marginBottom: 24 }}>
        <table style={{ borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr style={{ background: C.surfaceHigh }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", position: "sticky", left: 0, background: C.surfaceHigh, zIndex: 2, whiteSpace: "nowrap", borderBottom: "1px solid " + C.border, minWidth: 100 }}>
                Origin / Class
              </th>
              {classes.map(function(cl) {
                const hl = hoverCol === cl.name;
                return (
                  <th
                    key={cl.name}
                    onMouseEnter={function() { setHoverCol(cl.name); }}
                    onMouseLeave={function() { setHoverCol(null); }}
                    style={{ padding: "6px 8px", textAlign: "center", fontSize: 11, fontFamily: F.label, fontWeight: 700, color: hl ? C.secondary : C.textDim, letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid " + C.border, cursor: "default", background: hl ? C.secondary + "0d" : C.surfaceHigh, transition: "all 0.1s", whiteSpace: "nowrap" }}
                  >
                    {cl.name}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {origins.map(function(origin) {
              const hlRow = hoverRow === origin.name;
              return (
                <tr key={origin.name} style={{ background: hlRow ? C.surfaceHighest : "transparent" }}>
                  <td
                    onMouseEnter={function() { setHoverRow(origin.name); }}
                    onMouseLeave={function() { setHoverRow(null); }}
                    style={{ padding: "4px 12px", fontSize: 10, fontFamily: F.label, fontWeight: 700, color: hlRow ? C.primary : C.textMuted, borderBottom: "1px solid " + C.border + "44", position: "sticky", left: 0, background: hlRow ? C.surfaceHighest : C.surface, zIndex: 1, cursor: "default", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", transition: "all 0.1s" }}
                  >
                    {origin.name}
                  </td>
                  {classes.map(function(cl) {
                    const champs = grid[origin.name] ? grid[origin.name][cl.name] : [];
                    const isSel = selectedCell && selectedCell.o === origin.name && selectedCell.c === cl.name;
                    const hl = hoverRow === origin.name || hoverCol === cl.name;
                    return (
                      <td
                        key={cl.name}
                        onClick={function() {
                          if (!champs.length) return;
                          setSelectedCell(isSel ? null : { o: origin.name, c: cl.name });
                        }}
                        style={{ padding: 4, textAlign: "center", borderBottom: "1px solid " + C.border + "44", background: isSel ? C.secondary + "15" : hl ? C.surfaceHigh : "transparent", cursor: champs.length > 0 ? "pointer" : "default", minWidth: 56, transition: "background 0.1s" }}
                      >
                        {champs.length > 0 && (
                          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 1 }}>
                            {champs.slice(0, 4).map(function(ch) {
                              const col = COST_COLOR[ch.cost];
                              return (
                                <div key={ch.key} style={{ width: 20, height: 20, border: "1px solid " + col + "88", overflow: "hidden", background: C.surfaceHigh, flexShrink: 0 }}>
                                  {ch.assets && ch.assets.face && (
                                    <img src={ch.assets.face} alt={ch.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                                  )}
                                </div>
                              );
                            })}
                            {champs.length > 4 && (
                              <div style={{ width: 20, height: 20, background: C.surfaceHighest, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: C.textDim, fontFamily: F.label, fontWeight: 700 }}>
                                +{champs.length - 4}
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
        <div style={{ background: C.surface, border: "1px solid " + C.secondary + "44", borderLeft: "3px solid " + C.secondary, padding: "12px 14px", marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontFamily: F.label, color: C.secondary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            {selectedCell.o} + {selectedCell.c} — {cellChamps.length} unit{cellChamps.length !== 1 ? "s" : ""}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {cellChamps.map(function(ch) {
              return <ChampIcon key={ch.key} champ={ch} size={44} showName={true} />;
            })}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: F.label, color: C.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Origins — {origins.length}</div>
          {origins.map(function(t) {
            return <TraitLegendRow key={t.name} trait={t} champList={traitChamps[t.name] || []} open={openTrait === t.name} onToggle={function() { setOpenTrait(openTrait === t.name ? null : t.name); }} />;
          })}
        </div>
        <div>
          <div style={{ fontSize: 11, fontFamily: F.label, color: C.secondary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Classes — {classes.length}</div>
          {classes.map(function(t) {
            return <TraitLegendRow key={t.name} trait={t} champList={traitChamps[t.name] || []} open={openTrait === t.name} onToggle={function() { setOpenTrait(openTrait === t.name ? null : t.name); }} />;
          })}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, fontFamily: F.label, color: C.tertiary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Unique / Hero Traits</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {uniques.map(function(t) {
            const champs = traitChamps[t.name] || [];
            if (!champs.length) return null;
            return (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 6, background: C.surfaceLow, border: "1px solid " + C.tertiary + "22", borderLeft: "3px solid " + C.tertiary, padding: "4px 10px 4px 7px" }}>
                <span style={{ fontSize: 11, fontFamily: F.label, fontWeight: 700, color: C.tertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>{t.name}</span>
                {champs.map(function(ch) { return <ChampIcon key={ch.key} champ={ch} size={22} />; })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TraitLegendRow({ trait, champList, open, onToggle }) {
  const color = TRAIT_COLOR[trait.type] || C.borderLight;
  const breakpoints = trait.effects ? trait.effects.map(function(e) { return e.minUnits; }).filter(Boolean) : [];
  return (
    <div style={{ borderBottom: "1px solid " + C.border + "44" }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", background: open ? C.surfaceLow : "transparent" }}
        onClick={onToggle}
      >
        <div style={{ width: 3, height: 14, background: color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 10, fontFamily: F.label, fontWeight: 700, color: open ? color : C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{trait.name}</span>
        <div style={{ display: "flex", gap: 2 }}>
          {breakpoints.map(function(bp, i) {
            return <span key={i} style={{ fontSize: 10, padding: "0 5px", background: color + "22", color: color, fontFamily: F.label, fontWeight: 700 }}>{bp}</span>;
          })}
        </div>
        <span style={{ fontSize: 10, color: C.textDim }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "8px 12px 10px", background: C.surfaceLow + "88" }}>
          {trait.desc && (
            <p style={{ fontSize: 10, color: C.textMuted, fontFamily: F.body, margin: "0 0 8px", lineHeight: 1.5 }}>
              {trait.desc.replace(/<[^>]+>/g, " ").replace(/@[^@]+@/g, "X").replace(/\s+/g, " ").trim().slice(0, 200)}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {champList.map(function(ch) { return <ChampIcon key={ch.key} champ={ch} size={32} showName={true} />; })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SynergyGrid;
