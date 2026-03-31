import React, { useState, useMemo } from "react";
import { C, F, COST_COLOR, TRAIT_COLOR } from "../d17.js";
import ChampIcon from "../components/ChampIcon.jsx";
import TraitBadge from "../components/TraitBadge.jsx";

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
    if (ch) ch.traits.forEach(function(t) { if (selectedTraits.includes(t)) score += 1; });
  });
  (comp.flex || []).forEach(function(key) { if (selectedKeys.includes(key)) score += 1; });
  return score;
}

function SectionHeader({ text, color, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontFamily: F.headline, fontSize: 24, fontWeight: 700, textTransform: "uppercase", letterSpacing: -0.5, color: C.text, borderLeft: "4px solid " + color, paddingLeft: 12, margin: 0, lineHeight: 1 }}>
        {text}
      </h2>
      {sub && <p style={{ fontFamily: F.body, fontSize: 12, color: C.textDim, marginTop: 6, paddingLeft: 16 }}>{sub}</p>}
    </div>
  );
}

function OpenerAdvisor({ champions, traits, compLines }) {
  const [selected, setSelected] = useState([]);
  const [costFilter, setCostFilter] = useState([1, 2, 3]);
  const [expandedComp, setExpandedComp] = useState(null);

  const traitMap = useMemo(function() {
    const m = {};
    traits.forEach(function(t) { m[t.name] = t; });
    return m;
  }, [traits]);

  const displayChamps = useMemo(function() {
    return champions.filter(function(c) { return costFilter.includes(c.cost); });
  }, [champions, costFilter]);

  function toggleChamp(key) {
    setSelected(function(prev) {
      return prev.includes(key) ? prev.filter(function(k) { return k !== key; }) : [...prev, key];
    });
  }

  const activeTraitCounts = useMemo(function() {
    const counts = {};
    selected.forEach(function(key) {
      const ch = champions.find(function(c) { return c.key === key; });
      if (ch) ch.traits.forEach(function(t) { counts[t] = (counts[t] || 0) + 1; });
    });
    return counts;
  }, [selected, champions]);

  const rankedComps = useMemo(function() {
    if (selected.length === 0) return compLines;
    return [...compLines].sort(function(a, b) {
      return scoreComp(b, selected, champions) - scoreComp(a, selected, champions);
    });
  }, [selected, compLines, champions]);

  const maxScore = useMemo(function() {
    if (selected.length === 0) return 1;
    return Math.max(1, scoreComp(rankedComps[0], selected, champions));
  }, [rankedComps, selected, champions]);

  return (
    <div>
      <SectionHeader text="Opener Advisor" color={C.primary} sub="Select champions found early — comp lines rank by match score in real time." />

      {/* Champion picker */}
      <div style={{ background: C.surfaceLow, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontFamily: F.label, fontSize: 9, color: C.textDim, letterSpacing: 2, textTransform: "uppercase" }}>
            Champion Pool — click to select
          </span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[1, 2, 3, 4, 5].map(function(cost) {
              const active = costFilter.includes(cost);
              const col = COST_COLOR[cost];
              return (
                <button
                  key={cost}
                  onClick={function() {
                    setCostFilter(function(prev) {
                      return active ? prev.filter(function(c) { return c !== cost; }) : [...prev, cost].sort();
                    });
                  }}
                  style={{ width: 28, height: 28, border: "1px solid " + (active ? col : C.border), background: active ? col + "22" : "transparent", color: active ? col : C.textDim, fontSize: 10, fontFamily: F.label, fontWeight: 700, cursor: "pointer", transition: "all 0.1s" }}
                >
                  {cost}
                </button>
              );
            })}
            {selected.length > 0 && (
              <button
                onClick={function() { setSelected([]); }}
                style={{ padding: "0 10px", height: 28, border: "1px solid " + C.error + "66", background: C.error + "11", color: C.error, fontSize: 9, fontFamily: F.label, fontWeight: 700, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}
              >
                CLEAR {selected.length}
              </button>
            )}
          </div>
        </div>

        {/* Group by cost row */}
        {[1, 2, 3, 4, 5].filter(function(c) { return costFilter.includes(c); }).map(function(cost) {
          const group = displayChamps.filter(function(c) { return c.cost === cost; });
          const col = COST_COLOR[cost];
          return (
            <div key={cost} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 8, fontFamily: F.label, color: col, letterSpacing: 2, marginBottom: 5, textTransform: "uppercase", fontWeight: 700 }}>
                {cost}G  — {group.length} units
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {group.map(function(champ) {
                  return (
                    <ChampIcon
                      key={champ.key}
                      champ={champ}
                      size={44}
                      showName={true}
                      selected={selected.includes(champ.key)}
                      onClick={function() { toggleChamp(champ.key); }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active traits */}
      {selected.length > 0 && Object.keys(activeTraitCounts).length > 0 && (
        <div style={{ background: C.surface, border: "1px solid " + C.primary + "33", borderLeft: "3px solid " + C.primary, padding: "10px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontFamily: F.label, color: C.primary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Active Synergies</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(activeTraitCounts).sort(function(a, b) { return b[1] - a[1]; }).map(function(entry) {
              const name = entry[0];
              const count = entry[1];
              const trait = traitMap[name];
              if (!trait) return null;
              const breakpoints = trait.effects ? trait.effects.map(function(e) { return e.minUnits; }).filter(Boolean) : [];
              const nextBp = breakpoints.find(function(bp) { return bp > count; });
              const active = breakpoints.some(function(bp) { return bp <= count; });
              const col = TRAIT_COLOR[trait.type] || C.borderLight;
              return (
                <div
                  key={name}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: active ? col + "18" : C.surfaceHigh, border: "1px solid " + (active ? col + "55" : C.border), borderLeft: "3px solid " + (active ? col : C.border), padding: "3px 8px 3px 6px" }}
                >
                  <span style={{ fontSize: 10, fontFamily: F.label, fontWeight: 700, color: active ? col : C.textDim, letterSpacing: 0.5, textTransform: "uppercase" }}>{name}</span>
                  <span style={{ fontSize: 9, fontFamily: F.label, color: active ? col : C.textDim, fontWeight: 700 }}>{count}</span>
                  {breakpoints.length > 0 && (
                    <span style={{ fontSize: 8, color: C.textDim, fontFamily: F.label }}>
                      {breakpoints.map(function(bp, i) {
                        return (
                          <span key={i} style={{ color: bp <= count ? col : C.border, fontWeight: bp <= count ? 700 : 400, marginRight: 1 }}>{bp}</span>
                        );
                      })}
                    </span>
                  )}
                  {nextBp && (
                    <span style={{ fontSize: 8, color: C.textDim, fontFamily: F.label }}>need {nextBp - count} more</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comp cards */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 9, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          {selected.length === 0 ? "All Comp Lines" : "Ranked by Match Score"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {rankedComps.map(function(comp, idx) {
            const score = selected.length > 0 ? scoreComp(comp, selected, champions) : 0;
            const pct = selected.length > 0 ? Math.round((score / maxScore) * 100) : 0;
            const isBest = selected.length > 0 && idx === 0 && score > 0;
            const isExp = expandedComp === comp.id;
            return (
              <CompCard
                key={comp.id}
                comp={comp}
                champions={champions}
                traitMap={traitMap}
                score={score}
                pct={pct}
                isBest={isBest}
                selectedKeys={selected}
                expanded={isExp}
                onToggle={function() { setExpandedComp(isExp ? null : comp.id); }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompCard({ comp, champions, traitMap, score, pct, isBest, selectedKeys, expanded, onToggle }) {
  const accentCol = comp.color;
  return (
    <div style={{ background: C.surface, borderTop: "2px solid " + accentCol, position: "relative", gridColumn: expanded ? "1 / -1" : "auto" }}>
      <div style={{ padding: "12px 14px", cursor: "pointer" }} onClick={onToggle}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ fontFamily: F.headline, fontSize: 14, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: -0.3 }}>
                {comp.name}
              </span>
              <span style={{ fontSize: 8, padding: "1px 6px", background: accentCol + "22", color: accentCol, fontFamily: F.label, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", border: "1px solid " + accentCol + "44" }}>
                {comp.strategy}
              </span>
              {isBest && (
                <span style={{ fontSize: 8, padding: "1px 6px", background: C.success + "22", color: C.success, fontFamily: F.label, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                  BEST MATCH
                </span>
              )}
            </div>
            <p style={{ fontFamily: F.body, fontSize: 10, color: C.textDim, margin: 0, lineHeight: 1.4 }}>{comp.desc}</p>
          </div>
          {score > 0 && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontFamily: F.headline, fontWeight: 700, color: accentCol, lineHeight: 1 }}>{pct}<span style={{ fontSize: 10 }}>%</span></div>
              <div style={{ fontSize: 8, color: C.textDim, fontFamily: F.label, letterSpacing: 1 }}>MATCH</div>
            </div>
          )}
        </div>

        {score > 0 && (
          <div style={{ height: 2, background: C.border, marginBottom: 8 }}>
            <div style={{ height: "100%", width: pct + "%", background: accentCol, transition: "width 0.3s" }} />
          </div>
        )}

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {comp.core.map(function(key) {
            const ch = champions.find(function(c) { return c.key === key; });
            if (!ch) return null;
            const owned = selectedKeys.includes(key);
            return (
              <div key={key} style={{ opacity: owned ? 1 : 0.45, transition: "opacity 0.1s" }}>
                <ChampIcon champ={ch} size={38} />
              </div>
            );
          })}
          {comp.flex && comp.flex.length > 0 && (
            <div style={{ width: 1, background: C.border, margin: "0 2px", alignSelf: "stretch" }} />
          )}
          {(comp.flex || []).map(function(key) {
            const ch = champions.find(function(c) { return c.key === key; });
            if (!ch) return null;
            const owned = selectedKeys.includes(key);
            return (
              <div key={key} style={{ opacity: owned ? 0.75 : 0.25, transition: "opacity 0.1s" }}>
                <ChampIcon champ={ch} size={30} />
              </div>
            );
          })}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid " + C.border, padding: "12px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>BIS Items</div>
              {comp.items && Object.values(comp.items).map(function(items, gi) {
                return items.map(function(item, i) {
                  return (
                    <div key={gi + "_" + i} style={{ fontSize: 11, fontFamily: F.body, color: C.textMuted, paddingLeft: 10, borderLeft: "2px solid " + accentCol + "55", marginBottom: 4, lineHeight: 1.4 }}>
                      {item}
                    </div>
                  );
                });
              })}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Tactical Plan</div>
              <p style={{ fontSize: 11, fontFamily: F.body, color: C.textMuted, margin: "0 0 10px", lineHeight: 1.6 }}>{comp.gameplan}</p>
              {comp.god && (
                <div style={{ background: C.surfaceLow, border: "1px solid " + C.tertiary + "33", padding: "6px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, color: C.textDim, fontFamily: F.label, letterSpacing: 1, textTransform: "uppercase" }}>God:</span>
                  <span style={{ fontSize: 12, fontFamily: F.headline, fontWeight: 700, color: C.tertiary }}>{comp.god}</span>
                  {comp.godWhy && <span style={{ fontSize: 10, color: C.textDim, fontFamily: F.body }}>{comp.godWhy}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OpenerAdvisor;
