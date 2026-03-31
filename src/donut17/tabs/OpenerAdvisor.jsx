import React, { useState, useMemo } from "react";
import ChampIcon from "../components/ChampIcon.jsx";
import TraitBadge from "../components/TraitBadge.jsx";

const COST_COLORS = { 1: "#9ca3af", 2: "#22c55e", 3: "#3b82f6", 4: "#a855f7", 5: "#eab308" };

function scoreComp(comp, selectedKeys, allChamps) {
  let score = 0;
  const selectedTraits = [];
  selectedKeys.forEach(function(key) {
    const ch = allChamps.find(function(c) { return c.key === key; });
    if (ch) selectedTraits.push(...ch.traits);
  });

  comp.core.forEach(function(key) {
    if (selectedKeys.includes(key)) score += 3;
    const ch = allChamps.find(function(c) { return c.key === key; });
    if (ch) {
      ch.traits.forEach(function(t) {
        if (selectedTraits.includes(t)) score += 1;
      });
    }
  });

  (comp.flex || []).forEach(function(key) {
    if (selectedKeys.includes(key)) score += 1;
  });

  return score;
}

function OpenerAdvisor({ champions, traits, compLines }) {
  const [selected, setSelected] = useState([]);
  const [costFilter, setCostFilter] = useState([1, 2]);

  const traitMap = useMemo(function() {
    const m = {};
    traits.forEach(function(t) { m[t.name] = t; });
    return m;
  }, [traits]);

  const earlyChamps = useMemo(function() {
    return champions.filter(function(c) { return costFilter.includes(c.cost); });
  }, [champions, costFilter]);

  function toggleChamp(key) {
    setSelected(function(prev) {
      if (prev.includes(key)) return prev.filter(function(k) { return k !== key; });
      return [...prev, key];
    });
  }

  const activeTraitCounts = useMemo(function() {
    const counts = {};
    selected.forEach(function(key) {
      const ch = champions.find(function(c) { return c.key === key; });
      if (ch) {
        ch.traits.forEach(function(t) {
          counts[t] = (counts[t] || 0) + 1;
        });
      }
    });
    return counts;
  }, [selected, champions]);

  const rankedComps = useMemo(function() {
    if (selected.length === 0) return compLines;
    return [...compLines].sort(function(a, b) {
      return scoreComp(b, selected, champions) - scoreComp(a, selected, champions);
    });
  }, [selected, compLines, champions]);

  const topScore = selected.length > 0 ? scoreComp(rankedComps[0], selected, champions) : 0;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ fontFamily: "'Orbitron', monospace", fontSize: 16, color: "#a78bfa", margin: 0, fontWeight: 700, letterSpacing: 1 }}>
            OPENER ADVISOR
          </h2>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "'Chakra Petch', sans-serif" }}>Show:</span>
            {[1, 2, 3].map(function(cost) {
              const active = costFilter.includes(cost);
              const color = COST_COLORS[cost];
              return (
                <button
                  key={cost}
                  onClick={function() {
                    setCostFilter(function(prev) {
                      if (prev.includes(cost)) return prev.filter(function(c) { return c !== cost; });
                      return [...prev, cost].sort();
                    });
                  }}
                  style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid " + (active ? color : "#1e293b"), background: active ? color + "22" : "transparent", color: active ? color : "#475569", fontSize: 11, cursor: "pointer", fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700 }}
                >
                  {cost}g
                </button>
              );
            })}
            {selected.length > 0 && (
              <button
                onClick={function() { setSelected([]); }}
                style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #ef444444", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 11, cursor: "pointer", fontFamily: "'Chakra Petch', sans-serif" }}
              >
                Clear ({selected.length})
              </button>
            )}
          </div>
        </div>
        <p style={{ fontSize: 11, color: "#475569", fontFamily: "'Chakra Petch', sans-serif", margin: "0 0 12px" }}>
          Click champions you find early to get comp recommendations ranked by match score.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {earlyChamps.map(function(champ) {
            const isSel = selected.includes(champ.key);
            return (
              <ChampIcon
                key={champ.key}
                champ={champ}
                size={48}
                showName={true}
                selected={isSel}
                onClick={function() { toggleChamp(champ.key); }}
              />
            );
          })}
        </div>
      </div>

      {selected.length > 0 && Object.keys(activeTraitCounts).length > 0 && (
        <div style={{ marginBottom: 20, padding: "10px 14px", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 8, background: "rgba(167,139,250,0.05)" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'Orbitron', monospace", letterSpacing: 1, marginBottom: 8 }}>
            ACTIVE TRAITS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(activeTraitCounts).sort(function(a, b) { return b[1] - a[1]; }).map(function([name, count]) {
              const trait = traitMap[name];
              if (!trait) return null;
              return (
                <TraitBadge key={name} trait={trait} count={count} showCount={true} size="sm" />
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'Orbitron', monospace", letterSpacing: 1, marginBottom: 10 }}>
          {selected.length === 0 ? "ALL COMP LINES" : "COMPS RANKED BY MATCH"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rankedComps.map(function(comp, idx) {
            const score = selected.length > 0 ? scoreComp(comp, selected, champions) : 0;
            const isBest = selected.length > 0 && idx === 0 && score > 0;
            return (
              <CompCard key={comp.id} comp={comp} champions={champions} traitMap={traitMap} score={score} isBest={isBest} selectedKeys={selected} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompCard({ comp, champions, traitMap, score, isBest, selectedKeys }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: "1px solid " + (isBest ? comp.color : "#1e293b"),
        borderRadius: 8,
        background: isBest ? "rgba(255,255,255,0.03)" : "rgba(15,22,41,0.5)",
        overflow: "hidden",
        boxShadow: isBest ? ("0 0 12px " + comp.color + "33") : "none",
      }}
    >
      <div
        style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
        onClick={function() { setExpanded(function(v) { return !v; }); }}
      >
        <div style={{ width: 4, height: 36, borderRadius: 3, background: comp.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 13, color: comp.color, fontWeight: 700 }}>
              {comp.name.toUpperCase()}
            </span>
            {isBest && (
              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: comp.color, color: "#000", fontWeight: 900, fontFamily: "'Chakra Petch', sans-serif" }}>
                BEST MATCH
              </span>
            )}
            {score > 0 && (
              <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>
                +{score} pts
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'Chakra Petch', sans-serif" }}>
            {comp.desc}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {comp.core.slice(0, 6).map(function(key) {
            const ch = champions.find(function(c) { return c.key === key; });
            if (!ch) return null;
            const isOwned = selectedKeys.includes(key);
            return (
              <div key={key} style={{ opacity: isOwned ? 1 : 0.5 }}>
                <ChampIcon champ={ch} size={32} />
              </div>
            );
          })}
        </div>
        <span style={{ color: "#475569", fontSize: 12, flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "12px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: "#475569", fontFamily: "'Orbitron', monospace", letterSpacing: 1, marginBottom: 6 }}>CORE BOARD</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {comp.core.map(function(key) {
                  const ch = champions.find(function(c) { return c.key === key; });
                  if (!ch) return null;
                  return <ChampIcon key={key} champ={ch} size={36} showName={true} />;
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "#475569", fontFamily: "'Orbitron', monospace", letterSpacing: 1, marginBottom: 6 }}>FLEX UNITS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(comp.flex || []).map(function(key) {
                  const ch = champions.find(function(c) { return c.key === key; });
                  if (!ch) return null;
                  return <ChampIcon key={key} champ={ch} size={36} showName={true} />;
                })}
              </div>
            </div>
          </div>

          {comp.items && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: "#475569", fontFamily: "'Orbitron', monospace", letterSpacing: 1, marginBottom: 6 }}>BIS ITEMS</div>
              {Object.entries(comp.items).map(function([role, items]) {
                return (
                  <div key={role} style={{ marginBottom: 4 }}>
                    {items.map(function(item, i) {
                      return (
                        <div key={i} style={{ fontSize: 11, color: "#cbd5e1", fontFamily: "'Chakra Petch', sans-serif", padding: "2px 0", paddingLeft: 8, borderLeft: "2px solid " + comp.color + "55" }}>
                          {item}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {comp.gameplan && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: "#475569", fontFamily: "'Orbitron', monospace", letterSpacing: 1, marginBottom: 5 }}>GAME PLAN</div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Chakra Petch', sans-serif", lineHeight: 1.6, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 5 }}>
                {comp.gameplan}
              </div>
            </div>
          )}

          {comp.god && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "'Chakra Petch', sans-serif" }}>
              <span style={{ color: "#475569" }}>Recommended God:</span>
              <span style={{ color: "#a78bfa", fontWeight: 700 }}>{comp.god}</span>
              {comp.godWhy && (
                <span style={{ color: "#475569" }}>- {comp.godWhy}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OpenerAdvisor;
