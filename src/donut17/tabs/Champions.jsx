import React, { useState, useMemo } from "react";
import ChampIcon from "../components/ChampIcon.jsx";
import TraitBadge from "../components/TraitBadge.jsx";
import CostBadge from "../components/CostBadge.jsx";

const COST_COLORS = { 1: "#9ca3af", 2: "#22c55e", 3: "#3b82f6", 4: "#a855f7", 5: "#eab308" };
const COST_NAMES = { 1: "1-Cost", 2: "2-Cost", 3: "3-Cost", 4: "4-Cost", 5: "5-Cost" };

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
    const groups = {};
    filtered.forEach(function(c) {
      if (!groups[c.cost]) groups[c.cost] = [];
      groups[c.cost].push(c);
    });
    return groups;
  }, [filtered]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={function(e) { setSearch(e.target.value); }}
          placeholder="Search champion or trait..."
          style={{ flex: 1, minWidth: 160, padding: "7px 12px", borderRadius: 6, border: "1px solid #1e293b", background: "#0f1629", color: "#e2e8f0", fontFamily: "'Chakra Petch', sans-serif", fontSize: 12, outline: "none" }}
        />
        <button
          onClick={function() { setCostFilter(null); }}
          style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid " + (costFilter === null ? "#a78bfa" : "#1e293b"), background: costFilter === null ? "rgba(167,139,250,0.15)" : "transparent", color: costFilter === null ? "#a78bfa" : "#475569", fontSize: 11, cursor: "pointer", fontFamily: "'Chakra Petch', sans-serif" }}
        >
          All
        </button>
        {[1, 2, 3, 4, 5].map(function(c) {
          const color = COST_COLORS[c];
          const active = costFilter === c;
          return (
            <button
              key={c}
              onClick={function() { setCostFilter(active ? null : c); }}
              style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid " + (active ? color : "#1e293b"), background: active ? color + "22" : "transparent", color: active ? color : "#475569", fontSize: 11, cursor: "pointer", fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700 }}
            >
              {c}g
            </button>
          );
        })}
      </div>

      {Object.keys(byCost).sort(function(a, b) { return a - b; }).map(function(cost) {
        const color = COST_COLORS[parseInt(cost, 10)];
        const label = COST_NAMES[parseInt(cost, 10)];
        return (
          <div key={cost} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ height: 1, flex: 1, background: color + "33" }} />
              <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, color: color, fontWeight: 700, letterSpacing: 1 }}>
                {label}
              </span>
              <div style={{ height: 1, flex: 1, background: color + "33" }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {byCost[cost].map(function(champ) {
                const isExp = expanded === champ.key;
                return (
                  <div
                    key={champ.key}
                    style={{ border: "1px solid " + (isExp ? color : "#1e293b"), borderRadius: 8, overflow: "hidden", background: "rgba(15,22,41,0.6)", cursor: "pointer", width: isExp ? "100%" : "auto" }}
                    onClick={function() { setExpanded(isExp ? null : champ.key); }}
                  >
                    {!isExp ? (
                      <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                        <ChampIcon champ={champ} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "'Chakra Petch', sans-serif", fontWeight: 600, whiteSpace: "nowrap" }}>
                            {champ.name}
                          </div>
                          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 2 }}>
                            {champ.traits.map(function(t) {
                              const trait = traitMap[t];
                              if (!trait) return null;
                              return <TraitBadge key={t} trait={trait} />;
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <ChampDetail champ={champ} traitMap={traitMap} color={color} />
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

function StatBar({ label, value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: "#64748b", fontFamily: "'Chakra Petch', sans-serif" }}>{label}</span>
        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
      </div>
      <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function ChampDetail({ champ, traitMap, color }) {
  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
        <div style={{ flexShrink: 0 }}>
          <ChampIcon champ={champ} size={72} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 16, color: color, fontWeight: 700 }}>
              {champ.name.toUpperCase()}
            </span>
            <CostBadge cost={champ.cost} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {champ.traits.map(function(t) {
              const trait = traitMap[t];
              if (!trait) return null;
              return <TraitBadge key={t} trait={trait} size="lg" />;
            })}
          </div>
          {champ.ability && champ.ability.name && (
            <div>
              <div style={{ fontSize: 11, color: "#a78bfa", fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, marginBottom: 2 }}>
                {champ.ability.name}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Chakra Petch', sans-serif", lineHeight: 1.5 }}>
                {champ.ability.desc || "No description available."}
              </div>
            </div>
          )}
        </div>
      </div>
      {champ.stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
          <StatBar label="HP" value={champ.stats.hp} max={1500} color={color} />
          <StatBar label="Armor" value={champ.stats.armor} max={100} color={color} />
          <StatBar label="Attack" value={champ.stats.damage} max={100} color={color} />
          <StatBar label="Magic Resist" value={champ.stats.magicResist} max={100} color={color} />
          <StatBar label="Atk Speed" value={Math.round(champ.stats.attackSpeed * 100) / 100} max={1.5} color={color} />
          <StatBar label="Range" value={champ.stats.range} max={6} color={color} />
        </div>
      )}
    </div>
  );
}

export default Champions;
