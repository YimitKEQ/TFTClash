import React, { useState, useMemo } from "react";
import { C, F } from "../d17.js";
import augmentsData from "../data/augments.json";

var TIER_COLOR_MAP = { 1: "#a8a3be", 2: "#f0cc00", 3: "#c8b8ff" };
var TIER_BG_MAP    = { 1: "rgba(168,163,190,0.12)", 2: "rgba(240,204,0,0.12)", 3: "rgba(200,184,255,0.12)" };
var TIER_LABELS    = { 1: "Silver", 2: "Gold", 3: "Prismatic" };

function AugmentIcon({ icon, name }) {
  var [err, setErr] = useState(false);
  if (!err && icon) {
    return (
      <img
        src={icon}
        alt={name}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        onError={function() { setErr(true); }}
      />
    );
  }
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.textDim, fontFamily: F.label, fontWeight: 700 }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function Augments() {
  var [tierFilter, setTierFilter] = useState([]);
  var [traitFilter, setTraitFilter] = useState("all");
  var [search, setSearch] = useState("");

  var allTraits = useMemo(function() {
    var set = {};
    augmentsData.forEach(function(a) {
      (a.traits || []).forEach(function(t) { set[t] = true; });
    });
    return Object.keys(set).sort();
  }, []);

  var filtered = useMemo(function() {
    var q = search.toLowerCase().trim();
    return augmentsData.filter(function(a) {
      if (tierFilter.length > 0 && !tierFilter.includes(a.tier)) return false;
      if (traitFilter !== "all" && !(a.traits || []).includes(traitFilter)) return false;
      if (q && !a.name.toLowerCase().includes(q) && !a.desc.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tierFilter, traitFilter, search]);

  function toggleTier(t) {
    setTierFilter(function(prev) {
      return prev.includes(t) ? prev.filter(function(x) { return x !== t; }) : prev.concat([t]);
    });
  }

  var hasFilters = tierFilter.length > 0 || traitFilter !== "all" || search !== "";

  return (
    <div>
      <div style={{
        background: "linear-gradient(180deg, rgba(255,140,66,0.10) 0%, transparent 100%)",
        borderBottom: "1px solid " + C.border,
        padding: "32px 0 28px",
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 11, fontFamily: F.headline, fontWeight: 700, color: "#ff8c42", letterSpacing: 4, textTransform: "uppercase", marginBottom: 6, opacity: 0.85 }}>Set 17 · Space Gods</div>
        <h2 style={{ fontFamily: F.headline, fontWeight: 800, fontSize: 42, textTransform: "uppercase", letterSpacing: -1, color: C.text, lineHeight: 1, margin: "0 0 10px" }}>
          Augments
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 12, color: C.textDim, margin: 0 }}>
          {augmentsData.length} augments — Silver, Gold, Prismatic.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[1, 2, 3].map(function(t) {
          var active = tierFilter.includes(t);
          return (
            <button
              key={t}
              onClick={function() { toggleTier(t); }}
              style={{
                padding: "5px 14px",
                background: active ? TIER_BG_MAP[t] : C.surface,
                border: "1px solid " + (active ? TIER_COLOR_MAP[t] + "55" : C.border),
                color: active ? TIER_COLOR_MAP[t] : C.textDim,
                fontFamily: F.headline, fontSize: 13, fontWeight: 700,
                letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {TIER_LABELS[t]}
            </button>
          );
        })}
        <select
          value={traitFilter}
          onChange={function(e) { setTraitFilter(e.target.value); }}
          style={{ background: C.surface, border: "1px solid " + C.border, color: C.textDim, padding: "5px 10px", fontFamily: F.label, fontSize: 12, cursor: "pointer" }}
        >
          <option value="all">All Traits</option>
          {allTraits.map(function(t) { return <option key={t} value={t}>{t}</option>; })}
        </select>
        <input
          placeholder="Search augments..."
          value={search}
          onChange={function(e) { setSearch(e.target.value); }}
          style={{ background: C.surface, border: "1px solid " + C.border, color: C.text, padding: "5px 12px", fontFamily: F.label, fontSize: 12, outline: "none", flex: 1, minWidth: 160 }}
        />
        {hasFilters && (
          <button
            onClick={function() { setTierFilter([]); setTraitFilter("all"); setSearch(""); }}
            style={{ background: "transparent", border: "1px solid " + C.border, padding: "5px 12px", cursor: "pointer", fontFamily: F.label, fontSize: 11, color: C.textSub, letterSpacing: 1, textTransform: "uppercase" }}
          >
            Clear
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6 }}>
        {filtered.map(function(aug, idx) {
          var col = TIER_COLOR_MAP[aug.tier] || C.textDim;
          var bg  = TIER_BG_MAP[aug.tier]   || "transparent";
          return (
            <div
              key={idx}
              style={{
                background: C.surface,
                border: "1px solid " + C.border,
                borderTop: "2px solid " + col,
                padding: "12px 14px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div style={{ width: 44, height: 44, flexShrink: 0, background: bg, border: "1px solid " + col + "44", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AugmentIcon icon={aug.icon} name={aug.name} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontFamily: F.headline, fontWeight: 700, fontSize: 14, color: C.text, textTransform: "uppercase", letterSpacing: 0.3 }}>{aug.name}</span>
                  <span style={{ fontSize: 9, padding: "1px 6px", background: bg, color: col, fontFamily: F.label, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", border: "1px solid " + col + "44", flexShrink: 0 }}>{aug.tierLabel}</span>
                </div>
                <p style={{ fontFamily: F.body, fontSize: 11, color: C.textDim, margin: 0, lineHeight: 1.5 }}>{aug.desc}</p>
                {aug.traits && aug.traits.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {aug.traits.map(function(t) {
                      return (
                        <span key={t} style={{ fontSize: 9, padding: "1px 6px", background: C.primary + "18", color: C.primary, fontFamily: F.label, fontWeight: 700, letterSpacing: 0.5, border: "1px solid " + C.primary + "33" }}>
                          {t}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Augments;
