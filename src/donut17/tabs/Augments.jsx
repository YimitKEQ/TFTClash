import React, { useState, useMemo } from "react";
import { C, F } from "../d17.js";
import augmentsData from "../data/augments.json";

var TIER_COLOR   = { 1: "#a8a3be", 2: "#f0cc00", 3: "#c8b8ff" };
var TIER_BG      = { 1: "rgba(168,163,190,0.13)", 2: "rgba(240,204,0,0.13)", 3: "rgba(200,184,255,0.13)" };
var TIER_GLOW    = { 1: "rgba(168,163,190,0.18)", 2: "rgba(240,204,0,0.18)", 3: "rgba(200,184,255,0.22)" };
var TIER_LABELS  = { 1: "Silver", 2: "Gold", 3: "Prismatic" };
var TIER_COUNTS  = {
  1: augmentsData.filter(function(a) { return a.tier === 1; }).length,
  2: augmentsData.filter(function(a) { return a.tier === 2; }).length,
  3: augmentsData.filter(function(a) { return a.tier === 3; }).length,
};

function AugIcon({ aug }) {
  var [err, setErr] = useState(false);
  var col = TIER_COLOR[aug.tier] || C.textDim;
  if (!err && aug.icon) {
    return (
      <img
        src={aug.icon}
        alt={aug.name}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        onError={function() { setErr(true); }}
      />
    );
  }
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: col, fontFamily: F.label, fontWeight: 700 }}>
      {aug.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function AugCard({ aug, expanded, onToggle }) {
  var col = TIER_COLOR[aug.tier] || C.textDim;
  var bg  = TIER_BG[aug.tier]   || "transparent";

  return (
    <div
      onClick={onToggle}
      style={{
        background: expanded ? C.surface : C.surfaceLow,
        border: "1px solid " + (expanded ? col + "55" : C.border),
        borderTop: "2px solid " + col,
        cursor: "pointer",
        transition: "background 0.1s, border-color 0.1s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        {/* Icon */}
        <div style={{
          width: 44, height: 44, flexShrink: 0,
          background: expanded ? bg : C.surfaceHighest,
          border: "1px solid " + col + (expanded ? "66" : "33"),
          overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.1s",
        }}>
          <AugIcon aug={aug} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F.headline, fontSize: 12, fontWeight: 700, color: expanded ? C.text : C.textMuted, textTransform: "uppercase", letterSpacing: 0.3, lineHeight: 1.2, marginBottom: 4 }}>
            {aug.name}
          </div>
          {aug.traits && aug.traits.length > 0 && (
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {aug.traits.slice(0, 3).map(function(t) {
                return (
                  <span key={t} style={{ fontSize: 9, padding: "0 5px", background: C.primary + "18", color: C.primary, fontFamily: F.label, fontWeight: 700, letterSpacing: 0.3 }}>
                    {t}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {aug.traits && aug.traits.length === 0 && (
            <span style={{ fontSize: 8, padding: "1px 5px", background: bg, color: col, fontFamily: F.label, fontWeight: 700, letterSpacing: 0.5, border: "1px solid " + col + "33" }}>
              {aug.tierLabel}
            </span>
          )}
          <span style={{ fontSize: 14, color: expanded ? col : C.textSub, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 12px 12px", borderTop: "1px solid " + C.border + "44" }}>
          <p style={{ fontFamily: F.body, fontSize: 11, color: C.textDim, margin: "10px 0 0", lineHeight: 1.6 }}>
            {aug.desc || "No description available."}
          </p>
          {aug.traits && aug.traits.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              {aug.traits.map(function(t) {
                return (
                  <span key={t} style={{ fontSize: 9, padding: "1px 7px", background: C.primary + "18", color: C.primary, fontFamily: F.label, fontWeight: 700, letterSpacing: 0.5, border: "1px solid " + C.primary + "33" }}>
                    {t}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Augments() {
  var [activeTier, setActiveTier] = useState(2);
  var [traitFilter, setTraitFilter] = useState("all");
  var [search, setSearch] = useState("");
  var [expanded, setExpanded] = useState(null);

  var traitOptionsForTier = useMemo(function() {
    var set = {};
    augmentsData.filter(function(a) { return a.tier === activeTier; }).forEach(function(a) {
      (a.traits || []).forEach(function(t) { set[t] = true; });
    });
    return Object.keys(set).sort();
  }, [activeTier]);

  var filtered = useMemo(function() {
    var q = search.toLowerCase().trim();
    return augmentsData.filter(function(a) {
      if (a.tier !== activeTier) return false;
      if (traitFilter !== "all" && !(a.traits || []).includes(traitFilter)) return false;
      if (q && !a.name.toLowerCase().includes(q) && !(a.desc || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activeTier, traitFilter, search]);

  function handleTierSwitch(t) {
    setActiveTier(t);
    setTraitFilter("all");
    setExpanded(null);
  }

  var tierColor = TIER_COLOR[activeTier];
  var tierBg    = TIER_BG[activeTier];
  var tierGlow  = TIER_GLOW[activeTier];

  return (
    <div>
      {/* Hero */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: "linear-gradient(160deg, rgba(255,140,66,0.16) 0%, rgba(255,140,66,0.05) 60%, transparent 100%)",
        borderBottom: "1px solid " + C.border,
        padding: "52px 0 40px",
        marginBottom: 28,
      }}>
        <div style={{ position: "absolute", right: -60, top: -60, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,140,66,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ fontSize: 11, fontFamily: F.headline, fontWeight: 700, color: "#ff8c42", letterSpacing: 5, textTransform: "uppercase", marginBottom: 10 }}>Set 17 · Space Gods</div>
        <h2 style={{ fontFamily: F.headline, fontWeight: 900, fontSize: 72, textTransform: "uppercase", letterSpacing: -3, color: C.text, lineHeight: 0.88, margin: "0 0 18px" }}>
          Augments
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.textDim, margin: 0, lineHeight: 1.6 }}>
          {augmentsData.length} augments across Silver, Gold, and Prismatic tiers. Filter by trait or search by effect.
        </p>
      </div>

      {/* Tier tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid " + C.border }}>
        {[1, 2, 3].map(function(t) {
          var active = activeTier === t;
          var col    = TIER_COLOR[t];
          return (
            <button
              key={t}
              onClick={function() { handleTierSwitch(t); }}
              style={{
                padding: "0 28px",
                height: 52,
                background: active ? col + "10" : "transparent",
                border: "none",
                borderBottom: active ? ("3px solid " + col) : "3px solid transparent",
                color: active ? col : C.textDim,
                fontFamily: F.headline,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* Tier indicator diamond */}
              <div style={{
                width: 10, height: 10,
                background: active ? col : col + "55",
                transform: "rotate(45deg)",
                flexShrink: 0,
              }} />
              {TIER_LABELS[t]}
              <span style={{ fontSize: 11, color: active ? col : C.textSub, fontFamily: F.label, fontWeight: 400 }}>
                ({TIER_COUNTS[t]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter row */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {/* Trait pills */}
        <button
          onClick={function() { setTraitFilter("all"); }}
          style={{
            padding: "4px 12px", fontSize: 10, fontFamily: F.label, fontWeight: 700,
            background: traitFilter === "all" ? tierBg : "transparent",
            border: "1px solid " + (traitFilter === "all" ? tierColor : C.border),
            color: traitFilter === "all" ? tierColor : C.textDim,
            cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase",
          }}
        >
          All Traits
        </button>
        {traitOptionsForTier.map(function(t) {
          var active = traitFilter === t;
          return (
            <button
              key={t}
              onClick={function() { setTraitFilter(active ? "all" : t); }}
              style={{
                padding: "4px 10px", fontSize: 9, fontFamily: F.label, fontWeight: 700,
                background: active ? C.primary + "22" : "transparent",
                border: "1px solid " + (active ? C.primary : C.border),
                color: active ? C.primary : C.textSub,
                cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase",
              }}
            >
              {t}
            </button>
          );
        })}

        {/* Search */}
        <input
          placeholder="Search name or effect..."
          value={search}
          onChange={function(e) { setSearch(e.target.value); setExpanded(null); }}
          style={{
            marginLeft: "auto",
            padding: "5px 12px",
            background: C.surfaceLow, border: "1px solid " + C.border,
            color: C.text, fontSize: 11, fontFamily: F.label, outline: "none", width: 180,
          }}
        />
      </div>

      {/* Result count + glow bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ height: 2, width: 28, background: tierColor }} />
        <span style={{ fontFamily: F.label, fontSize: 11, fontWeight: 700, color: tierColor }}>
          {filtered.length}
        </span>
        <span style={{ fontFamily: F.label, fontSize: 11, color: C.textSub }}>
          {TIER_LABELS[activeTier]} augments
        </span>
        {(traitFilter !== "all" || search) && (
          <button
            onClick={function() { setTraitFilter("all"); setSearch(""); setExpanded(null); }}
            style={{ marginLeft: "auto", background: "transparent", border: "1px solid " + C.border, padding: "3px 10px", cursor: "pointer", fontFamily: F.label, fontSize: 10, color: C.textSub, letterSpacing: 1, textTransform: "uppercase" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Augment grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 3 }}>
        {filtered.map(function(aug, idx) {
          var key = aug.name + "_" + aug.tier;
          return (
            <AugCard
              key={key}
              aug={aug}
              expanded={expanded === key}
              onToggle={function() { setExpanded(expanded === key ? null : key); }}
            />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: C.textDim, fontFamily: F.label, fontSize: 11, letterSpacing: 1 }}>
          NO AUGMENTS FOUND
        </div>
      )}
    </div>
  );
}

export default Augments;
