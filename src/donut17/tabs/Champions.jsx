import React, { useState, useMemo } from "react";
import { C, F, COST_COLOR, TRAIT_COLOR } from "../d17.js";
import ChampIcon from "../components/ChampIcon.jsx";

const COST_NAMES = { 1: "1-Cost", 2: "2-Cost", 3: "3-Cost", 4: "4-Cost", 5: "5-Cost" };

function StatBar({ label, value, max, color }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: C.textDim, fontFamily: F.label, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
        <span style={{ fontSize: 9, color: C.textMuted, fontFamily: F.label, fontWeight: 600 }}>{typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(2)) : value}</span>
      </div>
      <div style={{ height: 3, background: C.border }}>
        <div style={{ height: "100%", width: pct + "%", background: color, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function Champions({ champions, traits }) {
  const [search, setSearch] = useState("");
  const [costFilter, setCostFilter] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const traitMap = useMemo(function() {
    const m = {};
    traits.forEach(function(t) { m[t.name] = t; });
    return m;
  }, [traits]);

  const filtered = useMemo(function() {
    const q = search.toLowerCase().trim();
    return champions.filter(function(c) {
      if (costFilter !== null && c.cost !== costFilter) return false;
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.traits.some(function(t) { return t.toLowerCase().includes(q); })) return true;
      return false;
    });
  }, [champions, costFilter, search]);

  const byCost = useMemo(function() {
    const g = {};
    filtered.forEach(function(c) {
      if (!g[c.cost]) g[c.cost] = [];
      g[c.cost].push(c);
    });
    return g;
  }, [filtered]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: F.headline, fontSize: 24, fontWeight: 700, textTransform: "uppercase", letterSpacing: -0.5, color: C.text, borderLeft: "4px solid " + C.primary, paddingLeft: 12, margin: 0, lineHeight: 1 }}>
            Champions
          </h2>
          <p style={{ fontFamily: F.body, fontSize: 12, color: C.textDim, marginTop: 6, paddingLeft: 16 }}>All 57 Set 17 units. Click to expand stats and ability.</p>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            value={search}
            onChange={function(e) { setSearch(e.target.value); }}
            placeholder="Search unit or trait..."
            style={{ padding: "6px 10px", background: C.surfaceLow, border: "1px solid " + C.border, color: C.text, fontSize: 11, fontFamily: F.label, outline: "none", width: 160 }}
          />
          <button
            onClick={function() { setCostFilter(null); }}
            style={{ padding: "6px 10px", border: "1px solid " + (costFilter === null ? C.primary : C.border), background: costFilter === null ? C.primary + "22" : "transparent", color: costFilter === null ? C.primary : C.textDim, fontSize: 9, fontFamily: F.label, fontWeight: 700, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}
          >
            ALL
          </button>
          {[1, 2, 3, 4, 5].map(function(c) {
            const col = COST_COLOR[c];
            const active = costFilter === c;
            return (
              <button
                key={c}
                onClick={function() { setCostFilter(active ? null : c); }}
                style={{ width: 28, height: 28, border: "1px solid " + (active ? col : C.border), background: active ? col + "22" : "transparent", color: active ? col : C.textDim, fontSize: 10, fontFamily: F.label, fontWeight: 700, cursor: "pointer" }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {Object.keys(byCost).sort(function(a, b) { return a - b; }).map(function(cost) {
        const costInt = parseInt(cost, 10);
        const col = COST_COLOR[costInt];
        const label = COST_NAMES[costInt] || (cost + "-cost");
        return (
          <div key={cost} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ height: 1, width: 12, background: col + "66" }} />
              <span style={{ fontFamily: F.label, fontSize: 9, color: col, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
                {label} — {byCost[cost].length} units
              </span>
              <div style={{ height: 1, flex: 1, background: col + "22" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 2 }}>
              {byCost[cost].map(function(champ) {
                const isExp = expanded === champ.key;
                return (
                  <div
                    key={champ.key}
                    style={{ background: isExp ? C.surface : C.surfaceLow, borderLeft: "3px solid " + col, cursor: "pointer", transition: "background 0.15s", gridColumn: isExp ? "1 / -1" : "auto" }}
                    onClick={function() { setExpanded(isExp ? null : champ.key); }}
                  >
                    {!isExp ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 0, height: 60 }}>
                        <div style={{ width: 60, height: 60, flexShrink: 0, overflow: "hidden" }}>
                          {champ.assets && champ.assets.face_lg && (
                            <img src={champ.assets.face_lg} alt={champ.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
                          )}
                        </div>
                        <div style={{ flex: 1, padding: "6px 10px", minWidth: 0 }}>
                          <div style={{ fontFamily: F.headline, fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                            {champ.name}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {champ.traits.filter(function(t) { return t !== "Choose Trait"; }).map(function(t) {
                              const trait = traitMap[t];
                              if (!trait || trait.type === "unique") return null;
                              const tcol = TRAIT_COLOR[trait.type] || C.borderLight;
                              return (
                                <span key={t} style={{ fontSize: 8, fontFamily: F.label, color: tcol, background: tcol + "15", padding: "1px 5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{t}</span>
                              );
                            })}
                            {champ.traits.filter(function(t) { return traitMap[t] && traitMap[t].type === "unique" && t !== "Choose Trait"; }).map(function(t) {
                              return (
                                <span key={t} style={{ fontSize: 8, fontFamily: F.label, color: C.tertiary, background: C.tertiary + "15", padding: "1px 5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{t}</span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <ChampDetail champ={champ} traitMap={traitMap} color={col} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChampDetail({ champ, traitMap, color }) {
  return (
    <div style={{ display: "flex", gap: 0 }}>
      <div style={{ width: 120, height: 120, flexShrink: 0, overflow: "hidden" }}>
        {champ.assets && champ.assets.face_lg && (
          <img src={champ.assets.face_lg} alt={champ.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={function(e) { e.target.style.display = "none"; }} />
        )}
      </div>
      <div style={{ flex: 1, padding: "14px 16px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: F.headline, fontSize: 18, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: -0.5 }}>{champ.name}</span>
          <span style={{ fontSize: 9, background: color + "22", color: color, padding: "2px 7px", fontFamily: F.label, fontWeight: 700, letterSpacing: 1 }}>{champ.cost}G</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
          {champ.traits.filter(function(t) { return t !== "Choose Trait"; }).map(function(t) {
            const trait = traitMap[t];
            if (!trait) return null;
            const tcol = TRAIT_COLOR[trait.type] || C.borderLight;
            return (
              <span key={t} style={{ fontSize: 9, fontFamily: F.label, color: tcol, background: tcol + "18", padding: "2px 7px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, borderLeft: "2px solid " + tcol }}>{t}</span>
            );
          })}
        </div>
        {champ.ability && champ.ability.name && (
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: C.primary, fontFamily: F.label, fontWeight: 700, letterSpacing: 0.5, marginRight: 8 }}>{champ.ability.name}</span>
            <span style={{ fontSize: 10, color: C.textMuted, fontFamily: F.body, lineHeight: 1.5 }}>{champ.ability.desc ? champ.ability.desc.replace(/<[^>]+>/g, "").replace(/@[^@]+@/g, "X").slice(0, 120) : ""}</span>
          </div>
        )}
        {champ.stats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px" }}>
            <StatBar label="HP" value={champ.stats.hp} max={1800} color={color} />
            <StatBar label="Armor" value={champ.stats.armor} max={80} color={color} />
            <StatBar label="MR" value={champ.stats.magicResist} max={80} color={color} />
            <StatBar label="AD" value={champ.stats.damage} max={100} color={color} />
            <StatBar label="AS" value={champ.stats.attackSpeed} max={1.2} color={color} />
            <StatBar label="Range" value={champ.stats.range} max={5} color={color} />
          </div>
        )}
      </div>
    </div>
  );
}

export default Champions;
