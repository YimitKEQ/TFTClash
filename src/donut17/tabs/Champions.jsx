import React, { useState, useMemo } from "react";
import { C, F, COST_COLOR, COST_BORDER, COST_GLOW, TRAIT_COLOR, STAT_COLOR, TIER_COLOR, TIER_BG } from "../d17.js";
import ChampIcon from "../components/ChampIcon.jsx";
import ItemIcon from "../components/ItemIcon.jsx";
import compLines from "../data/comp_lines.json";

var CHAMP_COMP_MAP = {};
compLines.forEach(function(comp) {
  (comp.core || []).forEach(function(champKey) {
    if (!CHAMP_COMP_MAP[champKey]) { CHAMP_COMP_MAP[champKey] = []; }
    var bisItems = (comp.items && comp.items[champKey]) ? comp.items[champKey] : [];
    CHAMP_COMP_MAP[champKey].push({
      compName: comp.name,
      compTier: comp.tier,
      compColor: comp.color,
      bisItems: bisItems,
    });
  });
});

var STAT_MAX = {
  hp: 2000,
  damage: 100,
  attackSpeed: 1.2,
  armor: 100,
  magicResist: 100,
  range: 7,
};

var STAT_LABELS = {
  hp: "HP",
  damage: "AD",
  attackSpeed: "AS",
  armor: "Armor",
  magicResist: "MR",
  range: "Range",
};

function StatBar(props) {
  var label = props.label;
  var value = props.value;
  var max = props.max;
  var gradient = props.gradient;
  var pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  var display = typeof value === "number"
    ? (Number.isInteger(value) ? String(value) : value.toFixed(2))
    : String(value);

  return React.createElement("div", { style: { marginBottom: 6 } },
    React.createElement("div", {
      style: {
        display: "flex", justifyContent: "space-between", marginBottom: 3,
      }
    },
      React.createElement("span", {
        style: {
          fontSize: 10, color: C.textDim, fontFamily: F.label,
          textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600,
        }
      }, label),
      React.createElement("span", {
        style: {
          fontSize: 10, color: C.textMuted, fontFamily: F.label, fontWeight: 700,
        }
      }, display)
    ),
    React.createElement("div", {
      style: {
        height: 4, background: C.border, borderRadius: 2, overflow: "hidden",
      }
    },
      React.createElement("div", {
        style: {
          height: "100%", width: pct + "%",
          background: gradient, borderRadius: 2,
          transition: "width 0.3s",
        }
      })
    )
  );
}

function ChampCard(props) {
  var champ = props.champ;
  var traitMap = props.traitMap;
  var isExpanded = props.isExpanded;
  var onToggle = props.onToggle;
  var col = COST_COLOR[champ.cost] || "#6b7280";
  var borderCol = COST_BORDER[champ.cost] || C.borderLight;
  var glow = COST_GLOW[champ.cost] || "transparent";

  return React.createElement("div", {
    style: {
      background: isExpanded ? C.surfaceHigh : C.surface,
      border: "1px solid " + (isExpanded ? borderCol : C.border),
      borderRadius: 12,
      overflow: "hidden",
      cursor: "pointer",
      transition: "all 0.15s",
      gridColumn: isExpanded ? "1 / -1" : "auto",
      boxShadow: isExpanded ? ("0 0 20px " + glow) : "none",
    },
    onClick: onToggle,
  },
    !isExpanded
      ? React.createElement("div", {
          style: {
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 14px",
          }
        },
          React.createElement(ChampIcon, {
            champ: champ, size: 56, showCost: true,
          }),
          React.createElement("div", {
            style: { flex: 1, minWidth: 0 }
          },
            React.createElement("div", {
              style: {
                fontFamily: F.headline, fontSize: 14, fontWeight: 700,
                color: C.text, textTransform: "uppercase", letterSpacing: 0.3,
                marginBottom: 5,
              }
            }, champ.name),
            React.createElement("div", {
              style: { display: "flex", flexWrap: "wrap", gap: 4 }
            },
              champ.traits.filter(function(t) { return t !== "Choose Trait"; }).map(function(t) {
                var trait = traitMap[t];
                if (!trait) return null;
                var tcol = TRAIT_COLOR[trait.type] || C.borderLight;
                return React.createElement("span", {
                  key: t,
                  style: {
                    fontSize: 10, fontFamily: F.label, color: tcol,
                    background: tcol + "15", padding: "1px 6px",
                    fontWeight: 600, textTransform: "uppercase",
                    letterSpacing: 0.5, borderRadius: 3,
                  }
                }, t);
              })
            )
          )
        )
      : React.createElement(ChampDetail, {
          champ: champ, traitMap: traitMap, color: col,
        })
  );
}

function ChampDetail(props) {
  var champ = props.champ;
  var traitMap = props.traitMap;
  var color = props.color;

  var statKeys = ["hp", "damage", "attackSpeed", "armor", "magicResist", "range"];

  var compEntries = CHAMP_COMP_MAP[champ.key] || [];
  var allBisItems = [];
  compEntries.forEach(function(e) {
    e.bisItems.forEach(function(it) { allBisItems.push(it); });
  });
  var bisFreq = {};
  allBisItems.forEach(function(it) { bisFreq[it] = (bisFreq[it] || 0) + 1; });
  var bisSorted = Object.keys(bisFreq).sort(function(a, b) { return bisFreq[b] - bisFreq[a]; });
  var bisTop = bisSorted.slice(0, 3);

  return React.createElement("div", {
    style: { display: "flex", gap: 0, flexWrap: "wrap" }
  },
    React.createElement("div", {
      style: {
        width: 120, height: 120, flexShrink: 0, overflow: "hidden",
        borderRadius: "12px 0 0 12px",
      }
    },
      champ.assets && champ.assets.face_lg
        ? React.createElement("img", {
            src: champ.assets.face_lg, alt: champ.name,
            style: {
              width: "100%", height: "100%",
              objectFit: "cover", display: "block",
            },
            onError: function(e) { e.target.style.display = "none"; },
          })
        : React.createElement("div", {
            style: {
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: C.surfaceHighest,
              fontSize: 28, fontFamily: F.headline, fontWeight: 800, color: color,
            }
          }, champ.name ? champ.name.slice(0, 3) : "?")
    ),
    React.createElement("div", {
      style: { flex: 1, padding: "14px 18px", minWidth: 240 }
    },
      React.createElement("div", {
        style: {
          display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
        }
      },
        React.createElement("span", {
          style: {
            fontFamily: F.headline, fontSize: 20, fontWeight: 700,
            color: C.text, textTransform: "uppercase", letterSpacing: -0.5,
          }
        }, champ.name),
        React.createElement("span", {
          style: {
            fontSize: 11, background: color + "22", color: color,
            padding: "2px 8px", borderRadius: 4,
            fontFamily: F.label, fontWeight: 700, letterSpacing: 1,
          }
        }, champ.cost + "G")
      ),
      React.createElement("div", {
        style: {
          display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12,
        }
      },
        champ.traits.filter(function(t) { return t !== "Choose Trait"; }).map(function(t) {
          var trait = traitMap[t];
          if (!trait) return null;
          var tcol = TRAIT_COLOR[trait.type] || C.borderLight;
          return React.createElement("span", {
            key: t,
            style: {
              fontSize: 11, fontFamily: F.label, color: tcol,
              background: tcol + "18", padding: "2px 8px",
              fontWeight: 700, textTransform: "uppercase",
              letterSpacing: 0.5, borderLeft: "2px solid " + tcol,
            }
          }, t);
        })
      ),
      champ.ability && champ.ability.name && React.createElement("div", {
        style: { marginBottom: 12 }
      },
        React.createElement("div", {
          style: {
            fontSize: 11, color: C.primary, fontFamily: F.label,
            fontWeight: 700, letterSpacing: 0.5, marginBottom: 4,
          }
        }, champ.ability.name),
        React.createElement("div", {
          style: {
            fontSize: 11, color: C.textMuted, fontFamily: F.body,
            lineHeight: 1.5, maxHeight: 36, overflow: "hidden",
          }
        }, champ.ability.desc
          ? champ.ability.desc.replace(/<[^>]+>/g, "").replace(/@[^@]+@/g, "X").slice(0, 140)
          : "")
      ),
      champ.stats && React.createElement("div", {
        style: {
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0 16px",
        }
      },
        statKeys.map(function(key) {
          if (champ.stats[key] == null) return null;
          return React.createElement(StatBar, {
            key: key,
            label: STAT_LABELS[key],
            value: champ.stats[key],
            max: STAT_MAX[key],
            gradient: STAT_COLOR[key],
          });
        })
      ),
      bisTop.length > 0 && React.createElement("div", {
        style: { marginTop: 12 }
      },
        React.createElement("div", {
          style: {
            fontSize: 10, color: C.textDim, fontFamily: F.label,
            fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
            marginBottom: 6,
          }
        }, "BIS Items"),
        React.createElement("div", {
          style: { display: "flex", gap: 6, flexWrap: "wrap" }
        },
          bisTop.map(function(itemKey) {
            return React.createElement(ItemIcon, {
              key: itemKey, itemKey: itemKey, size: 28, showName: true,
            });
          })
        )
      ),
      compEntries.length > 0 && React.createElement("div", {
        style: { marginTop: 12 }
      },
        React.createElement("div", {
          style: {
            fontSize: 10, color: C.textDim, fontFamily: F.label,
            fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
            marginBottom: 6,
          }
        }, "Appears In"),
        React.createElement("div", {
          style: { display: "flex", gap: 6, flexWrap: "wrap" }
        },
          compEntries.map(function(e) {
            var tc = TIER_COLOR[e.compTier] || C.textMuted;
            var tb = TIER_BG[e.compTier] || "transparent";
            return React.createElement("span", {
              key: e.compName,
              style: {
                fontSize: 11, fontFamily: F.label, fontWeight: 700,
                color: tc, background: tb,
                padding: "3px 10px", borderRadius: 6,
                border: "1px solid " + tc + "30",
                letterSpacing: 0.3,
              }
            },
              React.createElement("span", {
                style: {
                  fontSize: 9, fontWeight: 800, marginRight: 4,
                  opacity: 0.7,
                }
              }, e.compTier),
              e.compName
            );
          })
        )
      )
    )
  );
}

function SynergyGrid(props) {
  var champions = props.champions;
  var traits = props.traits;

  var groups = traits.filter(function(t) {
    return t.type === "origin" || t.type === "class";
  });

  return React.createElement("div", null,
    React.createElement("div", {
      style: {
        fontFamily: F.headline, fontSize: 13, fontWeight: 700,
        letterSpacing: 2, textTransform: "uppercase",
        color: C.textSecondary, marginBottom: 16,
      }
    }, "Champions grouped by trait"),
    React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 6,
      }
    },
      groups.map(function(trait) {
        var champs = champions.filter(function(c) {
          return c.traits.includes(trait.name);
        });
        if (champs.length === 0) return null;
        var tcol = TRAIT_COLOR[trait.type] || C.borderLight;
        return React.createElement("div", {
          key: trait.key,
          style: {
            background: C.surface,
            border: "1px solid " + C.border,
            borderRadius: 10,
            padding: "12px 14px",
          }
        },
          React.createElement("div", {
            style: {
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 8,
            }
          },
            React.createElement("div", {
              style: {
                width: 6, height: 6, borderRadius: "50%",
                background: tcol, flexShrink: 0,
              }
            }),
            React.createElement("span", {
              style: {
                fontFamily: F.headline, fontSize: 13, fontWeight: 700,
                color: tcol, textTransform: "uppercase", letterSpacing: 0.5,
              }
            }, trait.name),
            React.createElement("span", {
              style: {
                fontSize: 10, color: C.textDim, fontFamily: F.label,
                fontWeight: 600, marginLeft: "auto",
              }
            }, champs.length)
          ),
          React.createElement("div", {
            style: { display: "flex", flexWrap: "wrap", gap: 4 }
          },
            champs.map(function(ch) {
              return React.createElement(ChampIcon, {
                key: ch.key, champ: ch, size: 36,
              });
            })
          )
        );
      })
    )
  );
}

function Champions(props) {
  var champions = props.champions;
  var traits = props.traits;

  var viewState = useState("cards");
  var view = viewState[0];
  var setView = viewState[1];

  var searchState = useState("");
  var search = searchState[0];
  var setSearch = searchState[1];

  var costState = useState(null);
  var costFilter = costState[0];
  var setCostFilter = costState[1];

  var expandedState = useState(null);
  var expanded = expandedState[0];
  var setExpanded = expandedState[1];

  var traitMap = useMemo(function() {
    var m = {};
    traits.forEach(function(t) { m[t.name] = t; });
    return m;
  }, [traits]);

  var filtered = useMemo(function() {
    var q = search.toLowerCase().trim();
    return champions.filter(function(c) {
      if (costFilter !== null && c.cost !== costFilter) return false;
      if (!q) return true;
      if (c.name.toLowerCase().indexOf(q) >= 0) return true;
      if (c.traits.some(function(t) { return t.toLowerCase().indexOf(q) >= 0; })) return true;
      return false;
    });
  }, [champions, costFilter, search]);

  return React.createElement("div", null,
    React.createElement("div", {
      style: {
        position: "relative", overflow: "hidden",
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
      }, "Champions"),
      React.createElement("p", {
        style: {
          fontFamily: F.body, fontSize: 14, color: C.textMuted,
          margin: "0 0 20px", maxWidth: 520, lineHeight: 1.6,
        }
      }, champions.length + " Set 17 units with stats, abilities, and synergies."),
      React.createElement("div", {
        style: { display: "flex", gap: 6 }
      },
        React.createElement("button", {
          onClick: function() { setView("cards"); },
          style: {
            padding: "7px 20px", borderRadius: 8,
            background: view === "cards" ? C.primary + "22" : "transparent",
            border: "1px solid " + (view === "cards" ? C.primary : C.border),
            color: view === "cards" ? C.primary : C.textDim,
            fontFamily: F.headline, fontSize: 12, fontWeight: 700,
            letterSpacing: 1.5, textTransform: "uppercase",
            cursor: "pointer", transition: "all 0.15s",
          }
        }, "Unit Cards"),
        React.createElement("button", {
          onClick: function() { setView("grid"); },
          style: {
            padding: "7px 20px", borderRadius: 8,
            background: view === "grid" ? C.secondary + "22" : "transparent",
            border: "1px solid " + (view === "grid" ? C.secondary : C.border),
            color: view === "grid" ? C.secondary : C.textDim,
            fontFamily: F.headline, fontSize: 12, fontWeight: 700,
            letterSpacing: 1.5, textTransform: "uppercase",
            cursor: "pointer", transition: "all 0.15s",
          }
        }, "Synergy Grid")
      )
    ),
    view === "cards" && React.createElement("div", null,
      React.createElement("div", {
        style: {
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 20, flexWrap: "wrap",
        }
      },
        React.createElement("input", {
          type: "text",
          value: search,
          onChange: function(e) { setSearch(e.target.value); },
          placeholder: "Search unit or trait...",
          style: {
            width: 200, background: C.surface,
            border: "1px solid " + C.border, borderRadius: 8,
            padding: "8px 12px", fontFamily: F.body, fontSize: 13,
            color: C.text, outline: "none",
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
        }),
        React.createElement("div", { style: { flex: 1 } }),
        React.createElement("button", {
          onClick: function() { setCostFilter(null); },
          style: {
            padding: "6px 14px", borderRadius: 6,
            border: "1px solid " + (costFilter === null ? C.primary : C.border),
            background: costFilter === null ? C.primary + "20" : C.surface,
            color: costFilter === null ? C.primary : C.textDim,
            fontSize: 11, fontFamily: F.label, fontWeight: 700,
            cursor: "pointer", letterSpacing: 1, textTransform: "uppercase",
            transition: "all 0.15s",
            boxShadow: costFilter === null ? ("0 0 10px " + C.primary + "25") : "none",
          }
        }, "ALL"),
        [1, 2, 3, 4, 5].map(function(cost) {
          var col = COST_COLOR[cost];
          var glw = COST_GLOW[cost];
          var active = costFilter === cost;
          return React.createElement("button", {
            key: cost,
            onClick: function() { setCostFilter(active ? null : cost); },
            style: {
              width: 32, height: 32, borderRadius: 6,
              border: "1px solid " + (active ? col : C.border),
              background: active ? col + "22" : C.surface,
              color: active ? col : C.textDim,
              fontSize: 13, fontFamily: F.headline, fontWeight: 700,
              cursor: "pointer", transition: "all 0.15s",
              boxShadow: active ? ("0 0 12px " + glw) : "none",
            }
          }, cost);
        })
      ),
      filtered.length === 0 && React.createElement("div", {
        style: {
          textAlign: "center", padding: "48px 0",
          fontFamily: F.body, fontSize: 14, color: C.textDim,
        }
      }, "No champions match your filters."),
      React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 8,
        }
      },
        filtered.map(function(champ) {
          var isExp = expanded === champ.key;
          return React.createElement(ChampCard, {
            key: champ.key,
            champ: champ,
            traitMap: traitMap,
            isExpanded: isExp,
            onToggle: function() {
              setExpanded(isExp ? null : champ.key);
            },
          });
        })
      )
    ),
    view === "grid" && React.createElement(SynergyGrid, {
      champions: champions, traits: traits,
    })
  );
}

export default Champions;
