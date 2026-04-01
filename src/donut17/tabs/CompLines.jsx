import React, { useState } from "react";
import { C, F, COST_COLOR, TIER_COLOR, TIER_BG, TIER_GRADIENT, TIER_GLOW } from "../d17.js";
import ChampIcon from "../components/ChampIcon.jsx";
import ItemIcon from "../components/ItemIcon.jsx";
import TraitBadge from "../components/TraitBadge.jsx";
import traitsData from "../data/traits.json";

var TRAIT_MAP = {};
traitsData.forEach(function(t) { TRAIT_MAP[t.name] = t; });

var STRATEGY_COLOR = {
  "FAST 8":   C.secondary,
  "FAST 7":   C.secondary,
  "FAST 9":   C.secondary,
  "REROLL 6": C.primary,
  "REROLL 7": C.primary,
  "FLEX":     "#a8a3be",
};

var ALL_TIERS = ["S", "A", "B", "C"];
var TIER_CHIP_COLOR = { S: "#f0cc00", A: "#c084fc", B: "#60a5fa", C: "#4ade80" };

function TabHero(props) {
  var count = props.count || 0;
  return React.createElement("div", {
    style: {
      position: "relative",
      overflow: "hidden",
      background: "linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(125,200,255,0.07) 60%, transparent 100%)",
      borderRadius: 16,
      padding: "40px 32px",
      marginBottom: 28,
    }
  },
    React.createElement("div", {
      style: {
        position: "absolute", right: -60, top: -60,
        width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(200,184,255,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }
    }),
    React.createElement("h2", {
      style: {
        fontFamily: F.headline, fontWeight: 700, fontSize: 28,
        textTransform: "uppercase", color: C.text,
        margin: "0 0 8px", lineHeight: 1,
      }
    }, "Comp Lines"),
    React.createElement("p", {
      style: {
        fontFamily: F.body, fontSize: 14, color: C.textMuted,
        margin: 0, maxWidth: 520, lineHeight: 1.6,
      }
    }, count + " theorycrafted comps with core boards, BIS items, stage-by-stage game plans, and god picks.")
  );
}

function StageTimeline(props) {
  var comp = props.comp;
  var champMap = props.champMap;
  if (!comp.stages || Object.keys(comp.stages).length === 0) return null;

  return React.createElement("div", {
    style: {
      display: "flex", gap: 0, overflowX: "auto",
      paddingBottom: 4,
    }
  },
    [1, 2, 3, 4, 5].map(function(stageNum) {
      var stage = comp.stages[String(stageNum)];
      if (!stage) return null;
      var isLast = stageNum === 5;
      return React.createElement("div", {
        key: stageNum,
        style: {
          flex: 1, minWidth: 160,
          background: C.surface,
          border: "1px solid " + comp.color + "33",
          borderRight: isLast ? ("1px solid " + comp.color + "33") : "none",
          padding: 12,
          position: "relative",
        }
      },
        React.createElement("div", {
          style: {
            width: 28, height: 28, borderRadius: "50%",
            background: comp.color + "22",
            border: "1px solid " + comp.color + "55",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: F.headline, fontWeight: 900, fontSize: 16,
            color: comp.color, marginBottom: 8,
          }
        }, stageNum),
        React.createElement("div", {
          style: {
            fontFamily: F.headline, fontSize: 11, fontWeight: 700,
            color: comp.color, textTransform: "uppercase",
            letterSpacing: 1, marginBottom: 6, lineHeight: 1.2,
          }
        }, stage.label || ("Stage " + stageNum)),
        stage.units && stage.units.length > 0 && React.createElement("div", {
          style: { display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 8 }
        },
          stage.units.map(function(key) {
            var ch = champMap[key];
            if (!ch) return null;
            return React.createElement(ChampIcon, { key: key, champ: ch, size: 30 });
          })
        ),
        React.createElement("p", {
          style: {
            fontFamily: F.body, fontSize: 11, color: C.textDim,
            margin: 0, lineHeight: 1.6,
          }
        }, stage.tip),
        !isLast && React.createElement("div", {
          style: {
            position: "absolute", right: -10, top: "50%",
            transform: "translateY(-50%)",
            width: 0, height: 0,
            borderTop: "8px solid transparent",
            borderBottom: "8px solid transparent",
            borderLeft: "10px solid " + comp.color + "55",
            zIndex: 2,
          }
        })
      );
    })
  );
}

function CompCard(props) {
  var comp = props.comp;
  var champMap = props.champMap;
  var isExpanded = props.isExpanded;
  var onToggle = props.onToggle;
  var tier = comp.tier || "C";
  var stratCol = STRATEGY_COLOR[comp.strategy] || C.borderLight;

  var coreTraits = {};
  comp.core.forEach(function(key) {
    var ch = champMap[key];
    if (!ch || !ch.traits) return;
    ch.traits.forEach(function(tName) {
      if (!coreTraits[tName]) coreTraits[tName] = 0;
      coreTraits[tName] = coreTraits[tName] + 1;
    });
  });

  var traitList = Object.keys(coreTraits).sort(function(a, b) {
    return coreTraits[b] - coreTraits[a];
  }).slice(0, 5);

  return React.createElement("div", {
    style: {
      background: isExpanded ? C.surfaceHigh : C.surface,
      borderRadius: 14,
      border: "1px solid " + (isExpanded ? comp.color + "66" : C.border),
      overflow: "hidden",
      transition: "all 0.15s",
      gridColumn: isExpanded ? "1 / -1" : "auto",
    }
  },
    React.createElement("div", {
      onClick: onToggle,
      style: {
        padding: "16px 18px",
        display: "flex", alignItems: "flex-start", gap: 14,
        cursor: "pointer", userSelect: "none",
        position: "relative",
      }
    },
      React.createElement("div", {
        style: {
          width: 48, height: 48, borderRadius: 10, flexShrink: 0,
          background: TIER_GRADIENT[tier],
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: F.headline, fontWeight: 900, fontSize: 24, color: "#fff",
          boxShadow: "0 0 16px " + TIER_GLOW[tier],
        }
      }, tier),
      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
        React.createElement("div", {
          style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }
        },
          React.createElement("span", {
            style: {
              fontFamily: F.headline, fontWeight: 700, fontSize: 16,
              color: C.text, lineHeight: 1,
            }
          }, comp.name),
          React.createElement("span", {
            style: {
              fontSize: 10, padding: "2px 8px", borderRadius: 4,
              background: stratCol + "18", color: stratCol,
              fontFamily: F.headline, fontWeight: 700,
              letterSpacing: 1.5, textTransform: "uppercase",
              border: "1px solid " + stratCol + "40",
            }
          }, comp.strategy)
        ),
        React.createElement("p", {
          style: {
            fontFamily: F.body, fontSize: 13, color: C.textMuted,
            margin: "0 0 10px", lineHeight: 1.4,
          }
        }, comp.desc),
        React.createElement("div", {
          style: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 8 }
        },
          comp.core.map(function(key) {
            var ch = champMap[key];
            if (!ch) return null;
            return React.createElement(ChampIcon, {
              key: key, champ: ch, size: 44,
              showCarry: key === comp.carry,
            });
          })
        ),
        comp.items && comp.carry && comp.items[comp.carry] && React.createElement("div", {
          style: {
            display: "flex", alignItems: "center", gap: 4, marginBottom: 8,
            borderTop: "1px solid " + C.border,
            paddingTop: 8,
          }
        },
          React.createElement("span", {
            style: {
              fontFamily: F.label, fontSize: 10, fontWeight: 700,
              color: C.textDim, letterSpacing: 1, textTransform: "uppercase",
              marginRight: 4,
            }
          }, "BIS"),
          comp.items[comp.carry].map(function(itemKey, ii) {
            return React.createElement(ItemIcon, { key: ii, itemKey: itemKey, size: 28 });
          })
        ),
        traitList.length > 0 && React.createElement("div", {
          style: { display: "flex", gap: 4, flexWrap: "wrap" }
        },
          traitList.map(function(tName) {
            var traitObj = TRAIT_MAP[tName];
            if (!traitObj) return null;
            return React.createElement(TraitBadge, {
              key: tName, trait: traitObj, compact: true,
              count: coreTraits[tName], showCount: true,
            });
          })
        )
      ),
      React.createElement("div", {
        style: {
          color: C.textDim, fontSize: 20, flexShrink: 0,
          transform: isExpanded ? "rotate(180deg)" : "none",
          transition: "transform 0.2s", paddingTop: 4,
        }
      }, "\u25BE")
    ),
    !isExpanded && React.createElement("div", {
      onClick: onToggle,
      style: {
        padding: "8px 18px",
        borderTop: "1px solid " + C.border,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        cursor: "pointer",
        background: C.surfaceLow,
        borderRadius: "0 0 14px 14px",
      }
    },
      React.createElement("span", {
        style: {
          fontFamily: F.body, fontSize: 11, color: C.textDim,
        }
      }, "Stage plan, god pick, flex options"),
      React.createElement("span", {
        style: { fontSize: 10, color: C.textGhost }
      }, "\u25BE")
    ),
    isExpanded && React.createElement("div", {
      style: { borderTop: "1px solid " + C.border }
    },
      comp.stages && Object.keys(comp.stages).length > 0 && React.createElement("div", {
        style: { padding: "16px 18px 0" }
      },
        React.createElement("div", {
          style: {
            fontFamily: F.headline, fontSize: 10, fontWeight: 700,
            letterSpacing: 3, textTransform: "uppercase",
            color: comp.color, marginBottom: 12,
          }
        }, "Stage-by-Stage Game Plan"),
        React.createElement(StageTimeline, { comp: comp, champMap: champMap })
      ),
      React.createElement("div", {
        style: {
          padding: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 20,
        }
      },
        React.createElement("div", null,
          React.createElement("div", {
            style: {
              fontFamily: F.headline, fontSize: 10, fontWeight: 700,
              letterSpacing: 3, textTransform: "uppercase",
              color: comp.color, marginBottom: 10,
            }
          }, "God Pick"),
          React.createElement("div", {
            style: {
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 6,
            }
          },
            (function() {
              var godChamp = champMap[comp.god ? comp.god.toLowerCase().replace(/[^a-z0-9]/g, "") : ""];
              if (godChamp) {
                return React.createElement(ChampIcon, { champ: godChamp, size: 48 });
              }
              return React.createElement("div", {
                style: {
                  width: 48, height: 48, borderRadius: 10,
                  background: C.surfaceHighest,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, color: C.tertiary, fontFamily: F.headline, fontWeight: 800,
                }
              }, "?");
            })(),
            React.createElement("span", {
              style: {
                fontFamily: F.headline, fontSize: 20, fontWeight: 800,
                color: C.tertiary,
              }
            }, comp.god)
          ),
          React.createElement("p", {
            style: {
              fontFamily: F.body, fontSize: 11, color: C.textDim,
              margin: 0, lineHeight: 1.5,
            }
          }, comp.godWhy)
        ),
        comp.flex && comp.flex.length > 0 && React.createElement("div", null,
          React.createElement("div", {
            style: {
              fontFamily: F.headline, fontSize: 10, fontWeight: 700,
              letterSpacing: 3, textTransform: "uppercase",
              color: comp.color, marginBottom: 10,
            }
          }, "Flex Units"),
          React.createElement("div", {
            style: { display: "flex", gap: 4, flexWrap: "wrap" }
          },
            comp.flex.map(function(key) {
              var ch = champMap[key];
              if (!ch) return null;
              return React.createElement(ChampIcon, { key: key, champ: ch, size: 36 });
            })
          )
        ),
        comp.items && Object.keys(comp.items).filter(function(k) { return k !== comp.carry; }).length > 0 && React.createElement("div", null,
          React.createElement("div", {
            style: {
              fontFamily: F.headline, fontSize: 10, fontWeight: 700,
              letterSpacing: 3, textTransform: "uppercase",
              color: comp.color, marginBottom: 10,
            }
          }, "Secondary Items"),
          Object.entries(comp.items).filter(function(entry) { return entry[0] !== comp.carry; }).map(function(entry) {
            var key = entry[0];
            var itemList = entry[1];
            var ch = champMap[key];
            return React.createElement("div", {
              key: key,
              style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }
            },
              ch && React.createElement(ChampIcon, { champ: ch, size: 28 }),
              React.createElement("div", {
                style: { display: "flex", gap: 3 }
              },
                itemList.map(function(itemKey, ii) {
                  return React.createElement(ItemIcon, { key: ii, itemKey: itemKey, size: 24 });
                })
              )
            );
          })
        ),
        React.createElement("div", null,
          React.createElement("div", {
            style: {
              fontFamily: F.headline, fontSize: 10, fontWeight: 700,
              letterSpacing: 3, textTransform: "uppercase",
              color: comp.color, marginBottom: 10,
            }
          }, "Overview"),
          React.createElement("p", {
            style: {
              fontFamily: F.body, fontSize: 12, color: C.textMuted,
              lineHeight: 1.7, margin: 0,
            }
          }, comp.gameplan)
        )
      )
    )
  );
}

function CompLines(props) {
  var compLines = props.compLines;
  var champions = props.champions;

  var champMap = {};
  champions.forEach(function(c) { champMap[c.key] = c; });

  var expandedState = useState(null);
  var expanded = expandedState[0];
  var setExpanded = expandedState[1];

  var tierState = useState([]);
  var tierFilter = tierState[0];
  var setTierFilter = tierState[1];

  var searchState = useState("");
  var search = searchState[0];
  var setSearch = searchState[1];

  function toggleTier(t) {
    setTierFilter(function(prev) {
      return prev.includes(t) ? prev.filter(function(x) { return x !== t; }) : prev.concat([t]);
    });
  }

  var filtered = compLines.filter(function(comp) {
    if (tierFilter.length > 0 && !tierFilter.includes(comp.tier || "C")) return false;
    if (search.length > 0) {
      var q = search.toLowerCase();
      var nameMatch = (comp.name || "").toLowerCase().indexOf(q) >= 0;
      var descMatch = (comp.desc || "").toLowerCase().indexOf(q) >= 0;
      var stratMatch = (comp.strategy || "").toLowerCase().indexOf(q) >= 0;
      if (!nameMatch && !descMatch && !stratMatch) return false;
    }
    return true;
  });

  return React.createElement("div", null,
    React.createElement(TabHero, { count: compLines.length }),
    React.createElement("div", {
      style: {
        display: "flex", gap: 8, marginBottom: 24,
        flexWrap: "wrap", alignItems: "center",
      }
    },
      ALL_TIERS.map(function(t) {
        var active = tierFilter.includes(t);
        var chipCol = TIER_CHIP_COLOR[t];
        return React.createElement("button", {
          key: t,
          onClick: function() { toggleTier(t); },
          style: {
            display: "flex", alignItems: "center", gap: 8,
            background: active ? chipCol + "20" : C.surface,
            border: "1px solid " + (active ? chipCol : C.border),
            borderRadius: 8,
            padding: "6px 14px",
            cursor: "pointer",
            transition: "all 0.15s",
            boxShadow: active ? ("0 0 12px " + chipCol + "30") : "none",
          }
        },
          React.createElement("div", {
            style: {
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: active ? TIER_GRADIENT[t] : TIER_BG[t],
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: F.headline, fontWeight: 900, fontSize: 16,
              color: active ? "#fff" : TIER_COLOR[t],
            }
          }, t),
          React.createElement("span", {
            style: {
              fontFamily: F.headline, fontWeight: 700, fontSize: 12,
              letterSpacing: 1, textTransform: "uppercase",
              color: active ? C.text : C.textMuted,
            }
          }, t + " Tier")
        );
      }),
      tierFilter.length > 0 && React.createElement("button", {
        onClick: function() { setTierFilter([]); },
        style: {
          background: "transparent",
          border: "1px solid " + C.border,
          borderRadius: 8,
          padding: "6px 14px",
          cursor: "pointer",
          fontFamily: F.label, fontSize: 11, color: C.textDim,
          letterSpacing: 1, textTransform: "uppercase",
        }
      }, "Clear"),
      React.createElement("div", { style: { flex: 1 } }),
      React.createElement("input", {
        type: "text",
        placeholder: "Search comps...",
        value: search,
        onChange: function(e) { setSearch(e.target.value); },
        style: {
          width: 200,
          background: C.surface,
          border: "1px solid " + C.border,
          borderRadius: 8,
          padding: "8px 12px",
          fontFamily: F.body, fontSize: 13,
          color: C.text,
          outline: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        },
        onFocus: function(e) {
          e.currentTarget.style.borderColor = C.primary;
          e.currentTarget.style.boxShadow = "0 0 10px " + C.primary + "30";
        },
        onBlur: function(e) {
          e.currentTarget.style.borderColor = C.border;
          e.currentTarget.style.boxShadow = "none";
        },
      })
    ),
    filtered.length === 0 && React.createElement("div", {
      style: {
        textAlign: "center", padding: "48px 0",
        fontFamily: F.body, fontSize: 14, color: C.textDim,
      }
    }, "No comps match your filters."),
    React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))",
        gap: 12,
      }
    },
      filtered.map(function(comp) {
        return React.createElement(CompCard, {
          key: comp.id,
          comp: comp,
          champMap: champMap,
          isExpanded: expanded === comp.id,
          onToggle: function() {
            setExpanded(expanded === comp.id ? null : comp.id);
          },
        });
      })
    )
  );
}

export default CompLines;
