import React, { useState, useMemo } from "react";
import { C, F, AUG_COLOR } from "../d17.js";
import augmentsData from "../data/augments.json";

var h = React.createElement;

var TIER_LABELS = { 1: "Silver", 2: "Gold", 3: "Prismatic" };
var TIER_COUNTS = {
  1: augmentsData.filter(function(a) { return a.tier === 1; }).length,
  2: augmentsData.filter(function(a) { return a.tier === 2; }).length,
  3: augmentsData.filter(function(a) { return a.tier === 3; }).length,
};

var AUG_BG = {
  1: "rgba(192,192,192,0.10)",
  2: "rgba(240,204,0,0.10)",
  3: "rgba(232,121,249,0.10)",
};

var AUG_GLOW = {
  1: "0 0 12px rgba(192,192,192,0.20)",
  2: "0 0 12px rgba(240,204,0,0.25)",
  3: "0 0 12px rgba(232,121,249,0.25)",
};

function TierSelector(props) {
  var tier = props.tier;
  var active = props.active;
  var onSelect = props.onSelect;
  var col = AUG_COLOR[tier];
  var label = TIER_LABELS[tier];
  var count = TIER_COUNTS[tier];

  return h("button", {
    onClick: function() { onSelect(tier); },
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: "16px 12px",
      background: active ? AUG_BG[tier] : C.surfaceLow,
      border: "1px solid " + (active ? col : C.border),
      borderRadius: 10,
      boxShadow: active ? AUG_GLOW[tier] : "none",
      cursor: "pointer",
      transition: "all 0.15s",
    },
  },
    h("div", {
      style: {
        width: 14,
        height: 14,
        background: active ? col : col + "55",
        transform: "rotate(45deg)",
        flexShrink: 0,
        borderRadius: 2,
      },
    }),
    h("span", {
      style: {
        fontFamily: F.headline,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: active ? col : C.textDim,
      },
    }, label),
    h("span", {
      style: {
        fontFamily: F.label,
        fontSize: 11,
        fontWeight: 400,
        color: active ? col + "aa" : C.textGhost,
      },
    }, count)
  );
}

function AugIcon(props) {
  var aug = props.aug;
  var errState = useState(false);
  var err = errState[0];
  var setErr = errState[1];
  var col = AUG_COLOR[aug.tier] || C.textDim;

  if (!err && aug.icon) {
    return h("img", {
      src: aug.icon,
      alt: aug.name,
      style: { width: "100%", height: "100%", objectFit: "contain" },
      onError: function() { setErr(true); },
    });
  }

  return h("div", {
    style: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 11,
      color: col,
      fontFamily: F.label,
      fontWeight: 700,
    },
  }, aug.name.slice(0, 2).toUpperCase());
}

function AugCard(props) {
  var aug = props.aug;
  var expanded = props.expanded;
  var onToggle = props.onToggle;
  var col = AUG_COLOR[aug.tier] || C.textDim;
  var bg = AUG_BG[aug.tier] || "transparent";

  return h("div", {
    onClick: onToggle,
    style: {
      background: expanded ? C.surface : C.surfaceLow,
      border: "1px solid " + (expanded ? col + "55" : C.border),
      borderLeft: "3px solid " + col,
      borderRadius: 10,
      cursor: "pointer",
      transition: "background 0.1s, border-color 0.1s",
      display: "flex",
      flexDirection: "column",
    },
  },
    h("div", {
      style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" },
    },
      h("div", {
        style: {
          width: 44,
          height: 44,
          flexShrink: 0,
          background: expanded ? bg : C.surfaceHighest,
          border: "1px solid " + col + (expanded ? "66" : "33"),
          borderRadius: 8,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.1s",
        },
      }, h(AugIcon, { aug: aug })),

      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", {
          style: {
            fontFamily: F.headline,
            fontSize: 12,
            fontWeight: 700,
            color: expanded ? C.text : C.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.3,
            lineHeight: 1.2,
            marginBottom: 4,
          },
        }, aug.name),
        aug.traits && aug.traits.length > 0
          ? h("div", { style: { display: "flex", gap: 3, flexWrap: "wrap" } },
              aug.traits.slice(0, 3).map(function(t) {
                return h("span", {
                  key: t,
                  style: {
                    fontSize: 9,
                    padding: "0 5px",
                    background: C.primary + "18",
                    color: C.primary,
                    fontFamily: F.label,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    borderRadius: 3,
                  },
                }, t);
              })
            )
          : null
      ),

      h("div", {
        style: { flexShrink: 0, display: "flex", alignItems: "center", gap: 6 },
      },
        aug.traits && aug.traits.length === 0
          ? h("span", {
              style: {
                fontSize: 8,
                padding: "1px 5px",
                background: bg,
                color: col,
                fontFamily: F.label,
                fontWeight: 700,
                letterSpacing: 0.5,
                border: "1px solid " + col + "33",
                borderRadius: 3,
              },
            }, aug.tierLabel)
          : null,
        h("span", {
          style: {
            fontSize: 14,
            color: expanded ? col : C.textDim,
            transition: "transform 0.2s",
            display: "inline-block",
            transform: expanded ? "rotate(180deg)" : "none",
          },
        }, "\u25BE")
      )
    ),

    expanded
      ? h("div", {
          style: { padding: "0 12px 12px", borderTop: "1px solid " + C.border + "44" },
        },
          h("p", {
            style: {
              fontFamily: F.body,
              fontSize: 11,
              color: C.textDim,
              margin: "10px 0 0",
              lineHeight: 1.6,
            },
          }, aug.desc || "No description available."),
          aug.traits && aug.traits.length > 0
            ? h("div", { style: { marginTop: 10 } },
                h("div", {
                  style: {
                    fontFamily: F.label,
                    fontSize: 9,
                    fontWeight: 700,
                    color: C.textMuted,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  },
                }, "Works Well With"),
                h("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } },
                  aug.traits.map(function(t) {
                    return h("span", {
                      key: t,
                      style: {
                        fontSize: 9,
                        padding: "1px 7px",
                        background: C.primary + "18",
                        color: C.primary,
                        fontFamily: F.label,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        border: "1px solid " + C.primary + "33",
                        borderRadius: 3,
                      },
                    }, t);
                  })
                )
              )
            : null
        )
      : null
  );
}

function Augments() {
  var tierState = useState(2);
  var activeTier = tierState[0];
  var setActiveTier = tierState[1];

  var traitState = useState("all");
  var traitFilter = traitState[0];
  var setTraitFilter = traitState[1];

  var searchState = useState("");
  var search = searchState[0];
  var setSearch = searchState[1];

  var expandState = useState(null);
  var expanded = expandState[0];
  var setExpanded = expandState[1];

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

  var tierColor = AUG_COLOR[activeTier];

  return h("div", null,
    // Hero section
    h("div", {
      style: {
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(160deg, rgba(255,140,66,0.18) 0%, rgba(232,121,249,0.07) 60%, transparent 100%)",
        borderRadius: 16,
        padding: "40px 32px",
        marginBottom: 28,
      },
    },
      h("div", {
        style: {
          position: "absolute",
          right: -60,
          top: -60,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,140,66,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        },
      }),
      h("h2", {
        style: {
          fontFamily: F.headline,
          fontWeight: 700,
          fontSize: 28,
          textTransform: "uppercase",
          color: C.text,
          margin: "0 0 8px",
          lineHeight: 1,
        },
      }, "Augments"),
      h("p", {
        style: {
          fontFamily: F.body,
          fontSize: 14,
          color: C.textMuted,
          margin: 0,
        },
      }, augmentsData.length + " augments across Silver, Gold, and Prismatic tiers. Filter by trait or search by effect.")
    ),

    // Tier selector cards
    h("div", {
      style: { display: "flex", gap: 8, marginBottom: 20 },
    },
      h(TierSelector, { tier: 1, active: activeTier === 1, onSelect: handleTierSwitch }),
      h(TierSelector, { tier: 2, active: activeTier === 2, onSelect: handleTierSwitch }),
      h(TierSelector, { tier: 3, active: activeTier === 3, onSelect: handleTierSwitch })
    ),

    // Filter row
    h("div", {
      style: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" },
    },
      h("button", {
        onClick: function() { setTraitFilter("all"); },
        style: {
          padding: "4px 12px",
          fontSize: 10,
          fontFamily: F.label,
          fontWeight: 700,
          background: traitFilter === "all" ? C.orange + "22" : "transparent",
          border: "1px solid " + (traitFilter === "all" ? C.orange : C.border),
          borderRadius: 14,
          color: traitFilter === "all" ? C.orange : C.textDim,
          cursor: "pointer",
          letterSpacing: 0.5,
          textTransform: "uppercase",
        },
      }, "All Traits"),
      traitOptionsForTier.map(function(t) {
        var active = traitFilter === t;
        return h("button", {
          key: t,
          onClick: function() { setTraitFilter(active ? "all" : t); },
          style: {
            padding: "4px 10px",
            fontSize: 9,
            fontFamily: F.label,
            fontWeight: 700,
            background: active ? C.orange + "22" : "transparent",
            border: "1px solid " + (active ? C.orange : C.border),
            borderRadius: 14,
            color: active ? C.orange : C.textDim,
            cursor: "pointer",
            letterSpacing: 0.5,
            textTransform: "uppercase",
          },
        }, t);
      }),
      h("input", {
        placeholder: "Search name or effect...",
        value: search,
        onChange: function(e) { setSearch(e.target.value); setExpanded(null); },
        style: {
          marginLeft: "auto",
          padding: "5px 12px",
          background: C.surfaceLow,
          border: "1px solid " + C.border,
          borderRadius: 8,
          color: C.text,
          fontSize: 11,
          fontFamily: F.label,
          outline: "none",
          width: 180,
        },
      })
    ),

    // Result count
    h("div", {
      style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
    },
      h("div", { style: { height: 2, width: 28, background: tierColor, borderRadius: 1 } }),
      h("span", {
        style: { fontFamily: F.label, fontSize: 11, fontWeight: 700, color: tierColor },
      }, filtered.length),
      h("span", {
        style: { fontFamily: F.label, fontSize: 11, color: C.textDim },
      }, TIER_LABELS[activeTier] + " augments"),
      (traitFilter !== "all" || search)
        ? h("button", {
            onClick: function() { setTraitFilter("all"); setSearch(""); setExpanded(null); },
            style: {
              marginLeft: "auto",
              background: "transparent",
              border: "1px solid " + C.border,
              borderRadius: 6,
              padding: "3px 10px",
              cursor: "pointer",
              fontFamily: F.label,
              fontSize: 10,
              color: C.textDim,
              letterSpacing: 1,
              textTransform: "uppercase",
            },
          }, "Clear filters")
        : null
    ),

    // Augment grid
    h("div", {
      style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 },
    },
      filtered.map(function(aug) {
        var key = aug.name + "_" + aug.tier;
        return h(AugCard, {
          key: key,
          aug: aug,
          expanded: expanded === key,
          onToggle: function() { setExpanded(expanded === key ? null : key); },
        });
      })
    ),

    filtered.length === 0
      ? h("div", {
          style: {
            textAlign: "center",
            padding: "48px 0",
            color: C.textDim,
            fontFamily: F.label,
            fontSize: 11,
            letterSpacing: 1,
          },
        }, "NO AUGMENTS FOUND")
      : null
  );
}

export default Augments;
