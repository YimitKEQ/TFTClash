import React from "react";
import { C, F, COST_COLOR, TRAIT_COLOR } from "../d17.js";
import ChampIcon from "../components/ChampIcon.jsx";
import TraitBadge from "../components/TraitBadge.jsx";
import ItemIcon from "../components/ItemIcon.jsx";

function scoreComp(comp, selectedKeys, allChamps) {
  var score = 0;
  var selectedTraits = [];
  selectedKeys.forEach(function(key) {
    var ch = allChamps.find(function(c) { return c.key === key; });
    if (ch && ch.traits) {
      ch.traits.forEach(function(t) { selectedTraits.push(t); });
    }
  });
  comp.core.forEach(function(key) {
    if (selectedKeys.includes(key)) score += 3;
    var ch = allChamps.find(function(c) { return c.key === key; });
    if (ch && ch.traits) {
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

function CompCard(props) {
  var comp = props.comp;
  var champMap = props.champMap;
  var traitMap = props.traitMap;
  var score = props.score;
  var pct = props.pct;
  var isBest = props.isBest;
  var selectedKeys = props.selectedKeys;
  var isExpanded = props.expanded;
  var onToggle = props.onToggle;
  var accentCol = comp.color || C.primary;

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
      border: "1px solid " + (isBest ? accentCol + "66" : C.border),
      overflow: "hidden",
      transition: "all 0.15s",
      gridColumn: isExpanded ? "1 / -1" : "auto",
    }
  },
    // Header area (clickable)
    React.createElement("div", {
      onClick: onToggle,
      style: {
        padding: "16px 18px",
        display: "flex", alignItems: "flex-start", gap: 14,
        cursor: "pointer", userSelect: "none",
        position: "relative",
      }
    },
      // Match percentage badge (left side)
      score > 0
        ? React.createElement("div", {
            style: {
              width: 52, height: 52, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg, " + accentCol + "30 0%, " + accentCol + "10 100%)",
              border: "1px solid " + accentCol + "55",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }
          },
            React.createElement("span", {
              style: {
                fontFamily: F.headline, fontWeight: 900, fontSize: 20,
                color: accentCol, lineHeight: 1,
              }
            }, pct),
            React.createElement("span", {
              style: {
                fontFamily: F.label, fontSize: 8, fontWeight: 700,
                color: accentCol, letterSpacing: 1, textTransform: "uppercase",
                opacity: 0.8,
              }
            }, "%")
          )
        : React.createElement("div", {
            style: {
              width: 52, height: 52, borderRadius: 12, flexShrink: 0,
              background: C.surfaceLow,
              border: "1px solid " + C.border,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: F.headline, fontWeight: 700, fontSize: 11,
              color: C.textDim, letterSpacing: 1,
            }
          }, "--"),
      // Main content
      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
        // Name row + badges
        React.createElement("div", {
          style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }
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
              background: accentCol + "18", color: accentCol,
              fontFamily: F.headline, fontWeight: 700,
              letterSpacing: 1.5, textTransform: "uppercase",
              border: "1px solid " + accentCol + "40",
            }
          }, comp.strategy),
          isBest && React.createElement("span", {
            style: {
              fontSize: 9, padding: "2px 8px", borderRadius: 4,
              background: C.success + "22", color: C.success,
              fontFamily: F.headline, fontWeight: 800,
              letterSpacing: 1.5, textTransform: "uppercase",
              border: "1px solid " + C.success + "44",
            }
          }, "BEST MATCH")
        ),
        // Description
        React.createElement("p", {
          style: {
            fontFamily: F.body, fontSize: 13, color: C.textMuted,
            margin: "0 0 10px", lineHeight: 1.4,
          }
        }, comp.desc),
        // Match progress bar
        score > 0 && React.createElement("div", {
          style: { height: 3, background: C.border, marginBottom: 10, borderRadius: 2 }
        },
          React.createElement("div", {
            style: {
              height: "100%", width: pct + "%",
              background: "linear-gradient(90deg, " + accentCol + " 0%, " + accentCol + "88 100%)",
              borderRadius: 2, transition: "width 0.3s",
            }
          })
        ),
        // Core champs row
        React.createElement("div", {
          style: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 8 }
        },
          comp.core.map(function(key) {
            var ch = champMap[key];
            if (!ch) return null;
            var owned = selectedKeys.includes(key);
            return React.createElement("div", {
              key: key,
              style: { opacity: owned ? 1 : 0.45, transition: "opacity 0.15s" }
            },
              React.createElement(ChampIcon, {
                champ: ch, size: 40,
                showCarry: key === comp.carry,
              })
            );
          })
        ),
        // BIS items for carry
        comp.items && comp.carry && comp.items[comp.carry] && React.createElement("div", {
          style: {
            display: "flex", alignItems: "center", gap: 4, marginBottom: 8,
            borderTop: "1px solid " + C.border, paddingTop: 8,
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
        // Trait badges
        traitList.length > 0 && React.createElement("div", {
          style: { display: "flex", gap: 4, flexWrap: "wrap" }
        },
          traitList.map(function(tName) {
            var traitObj = traitMap[tName];
            if (!traitObj) return null;
            return React.createElement(TraitBadge, {
              key: tName, trait: traitObj, compact: true,
              count: coreTraits[tName], showCount: true,
            });
          })
        )
      ),
      // Expand arrow
      React.createElement("div", {
        style: {
          color: C.textDim, fontSize: 20, flexShrink: 0,
          transform: isExpanded ? "rotate(180deg)" : "none",
          transition: "transform 0.2s", paddingTop: 4,
        }
      }, "\u25BE")
    ),
    // Expand hint footer (collapsed)
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
        style: { fontFamily: F.body, fontSize: 11, color: C.textDim }
      }, "Stage plan, god pick, flex options"),
      React.createElement("span", {
        style: { fontSize: 10, color: C.textGhost }
      }, "\u25BE")
    ),
    // Expanded detail section
    isExpanded && React.createElement("div", {
      style: { borderTop: "1px solid " + C.border }
    },
      // Stage timeline
      comp.stages && Object.keys(comp.stages).length > 0 && React.createElement("div", {
        style: { padding: "16px 18px 0" }
      },
        React.createElement("div", {
          style: {
            fontFamily: F.headline, fontSize: 10, fontWeight: 700,
            letterSpacing: 3, textTransform: "uppercase",
            color: accentCol, marginBottom: 12,
          }
        }, "Stage-by-Stage Game Plan"),
        React.createElement("div", {
          style: { display: "flex", gap: 0, overflowX: "auto", paddingBottom: 4 }
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
                border: "1px solid " + accentCol + "33",
                borderRight: isLast ? ("1px solid " + accentCol + "33") : "none",
                padding: 12, position: "relative",
              }
            },
              React.createElement("div", {
                style: {
                  width: 28, height: 28, borderRadius: "50%",
                  background: accentCol + "22",
                  border: "1px solid " + accentCol + "55",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: F.headline, fontWeight: 900, fontSize: 16,
                  color: accentCol, marginBottom: 8,
                }
              }, stageNum),
              React.createElement("div", {
                style: {
                  fontFamily: F.headline, fontSize: 11, fontWeight: 700,
                  color: accentCol, textTransform: "uppercase",
                  letterSpacing: 1, marginBottom: 6, lineHeight: 1.2,
                }
              }, stage.label || ("Stage " + stageNum)),
              stage.units && stage.units.length > 0 && React.createElement("div", {
                style: { display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 8 }
              },
                stage.units.slice(0, 6).map(function(key) {
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
                  borderLeft: "10px solid " + accentCol + "55",
                  zIndex: 2,
                }
              })
            );
          })
        )
      ),
      // Detail grid: God, Flex, Items, Overview
      React.createElement("div", {
        style: {
          padding: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 20,
        }
      },
        // God Pick
        React.createElement("div", null,
          React.createElement("div", {
            style: {
              fontFamily: F.headline, fontSize: 10, fontWeight: 700,
              letterSpacing: 3, textTransform: "uppercase",
              color: accentCol, marginBottom: 10,
            }
          }, "God Pick"),
          React.createElement("div", {
            style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }
          },
            (function() {
              var godKey = comp.god ? comp.god.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
              var godChamp = champMap[godKey];
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
        // Flex Units
        comp.flex && comp.flex.length > 0 && React.createElement("div", null,
          React.createElement("div", {
            style: {
              fontFamily: F.headline, fontSize: 10, fontWeight: 700,
              letterSpacing: 3, textTransform: "uppercase",
              color: accentCol, marginBottom: 10,
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
        // Secondary items
        comp.items && Object.keys(comp.items).filter(function(k) { return k !== comp.carry; }).length > 0 && React.createElement("div", null,
          React.createElement("div", {
            style: {
              fontFamily: F.headline, fontSize: 10, fontWeight: 700,
              letterSpacing: 3, textTransform: "uppercase",
              color: accentCol, marginBottom: 10,
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
        // Overview
        React.createElement("div", null,
          React.createElement("div", {
            style: {
              fontFamily: F.headline, fontSize: 10, fontWeight: 700,
              letterSpacing: 3, textTransform: "uppercase",
              color: accentCol, marginBottom: 10,
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

function OpenerAdvisor(props) {
  var champions = props.champions;
  var traits = props.traits;
  var compLines = props.compLines;

  var selectedState = React.useState([]);
  var selected = selectedState[0];
  var setSelected = selectedState[1];

  var costState = React.useState([1, 2, 3]);
  var costFilter = costState[0];
  var setCostFilter = costState[1];

  var expandedState = React.useState(null);
  var expandedComp = expandedState[0];
  var setExpandedComp = expandedState[1];

  var traitMap = React.useMemo(function() {
    var m = {};
    traits.forEach(function(t) { m[t.name] = t; });
    return m;
  }, [traits]);

  var champMap = React.useMemo(function() {
    var m = {};
    champions.forEach(function(c) { m[c.key] = c; });
    return m;
  }, [champions]);

  var displayChamps = React.useMemo(function() {
    return champions.filter(function(c) { return costFilter.includes(c.cost); });
  }, [champions, costFilter]);

  function toggleChamp(key) {
    setSelected(function(prev) {
      if (prev.includes(key)) {
        return prev.filter(function(k) { return k !== key; });
      }
      return prev.concat(key);
    });
  }

  function toggleCost(cost) {
    setCostFilter(function(prev) {
      if (prev.includes(cost)) {
        return prev.filter(function(c) { return c !== cost; });
      }
      return prev.concat(cost).sort();
    });
  }

  function removeChamp(key) {
    setSelected(function(prev) {
      return prev.filter(function(k) { return k !== key; });
    });
  }

  var activeTraitCounts = React.useMemo(function() {
    var counts = {};
    selected.forEach(function(key) {
      var ch = champions.find(function(c) { return c.key === key; });
      if (ch && ch.traits) {
        ch.traits.forEach(function(t) { counts[t] = (counts[t] || 0) + 1; });
      }
    });
    return counts;
  }, [selected, champions]);

  var rankedComps = React.useMemo(function() {
    if (selected.length === 0) return compLines;
    return compLines.slice().sort(function(a, b) {
      return scoreComp(b, selected, champions) - scoreComp(a, selected, champions);
    });
  }, [selected, compLines, champions]);

  var maxScore = React.useMemo(function() {
    if (selected.length === 0) return 1;
    return Math.max(1, scoreComp(rankedComps[0], selected, champions));
  }, [rankedComps, selected, champions]);

  // Group champs by cost for the picker
  var costGroups = React.useMemo(function() {
    var groups = {};
    [1, 2, 3, 4, 5].forEach(function(cost) {
      groups[cost] = displayChamps.filter(function(c) { return c.cost === cost; });
    });
    return groups;
  }, [displayChamps]);

  return React.createElement("div", null,
    // Hero section
    React.createElement("div", {
      style: {
        position: "relative", overflow: "hidden",
        background: "linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(125,200,255,0.07) 60%, transparent 100%)",
        borderRadius: 16, padding: "40px 32px", marginBottom: 28,
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
      }, "Opener Advisor"),
      React.createElement("p", {
        style: {
          fontFamily: F.body, fontSize: 14, color: C.textMuted,
          margin: 0, maxWidth: 520, lineHeight: 1.6,
        }
      }, "Select your early game units to find which comp lines match your opener.")
    ),

    // Selected units bar
    selected.length > 0 && React.createElement("div", {
      style: {
        background: C.surface, borderRadius: 12,
        border: "1px solid " + C.primary + "33",
        padding: "12px 16px", marginBottom: 16,
      }
    },
      React.createElement("div", {
        style: {
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 10,
        }
      },
        React.createElement("span", {
          style: {
            fontFamily: F.label, fontSize: 10, fontWeight: 700,
            color: C.primary, letterSpacing: 2, textTransform: "uppercase",
          }
        }, "Selected Units (" + selected.length + ")"),
        React.createElement("button", {
          onClick: function() { setSelected([]); },
          style: {
            padding: "4px 12px", border: "1px solid " + C.error + "44",
            background: C.error + "11", color: C.error,
            fontSize: 10, fontFamily: F.label, fontWeight: 700,
            cursor: "pointer", letterSpacing: 1, textTransform: "uppercase",
            borderRadius: 6,
          }
        }, "CLEAR ALL")
      ),
      React.createElement("div", {
        style: { display: "flex", gap: 8, flexWrap: "wrap" }
      },
        selected.map(function(key) {
          var ch = champions.find(function(c) { return c.key === key; });
          if (!ch) return null;
          return React.createElement("div", {
            key: key,
            style: {
              display: "inline-flex", alignItems: "center", gap: 6,
              background: C.surfaceHigh, borderRadius: 8,
              border: "1px solid " + C.border, padding: "4px 8px 4px 4px",
            }
          },
            React.createElement(ChampIcon, { champ: ch, size: 28 }),
            React.createElement("span", {
              style: {
                fontFamily: F.body, fontSize: 11, color: C.text, fontWeight: 500,
              }
            }, ch.name),
            React.createElement("button", {
              onClick: function() { removeChamp(key); },
              style: {
                width: 18, height: 18, borderRadius: 4,
                background: C.error + "22", border: "1px solid " + C.error + "44",
                color: C.error, fontSize: 12, fontWeight: 700,
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
                padding: 0, lineHeight: 1,
              }
            }, "X")
          );
        })
      )
    ),

    // Champion picker
    React.createElement("div", {
      style: {
        background: C.surfaceLow, borderRadius: 12,
        padding: 16, marginBottom: 16,
      }
    },
      // Picker header with cost filters
      React.createElement("div", {
        style: {
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14, flexWrap: "wrap", gap: 8,
        }
      },
        React.createElement("span", {
          style: {
            fontFamily: F.label, fontSize: 10, fontWeight: 700,
            color: C.textDim, letterSpacing: 2, textTransform: "uppercase",
          }
        }, "Champion Pool"),
        React.createElement("div", {
          style: { display: "flex", gap: 4, alignItems: "center" }
        },
          [1, 2, 3, 4, 5].map(function(cost) {
            var active = costFilter.includes(cost);
            var col = COST_COLOR[cost];
            return React.createElement("button", {
              key: cost,
              onClick: function() { toggleCost(cost); },
              style: {
                width: 30, height: 30, borderRadius: 6,
                border: "1px solid " + (active ? col : C.border),
                background: active ? col + "22" : "transparent",
                color: active ? col : C.textDim,
                fontSize: 11, fontFamily: F.label, fontWeight: 700,
                cursor: "pointer", transition: "all 0.1s",
              }
            }, cost);
          })
        )
      ),
      // Champions grouped by cost
      [1, 2, 3, 4, 5].filter(function(c) { return costFilter.includes(c); }).map(function(cost) {
        var group = costGroups[cost] || [];
        if (group.length === 0) return null;
        var col = COST_COLOR[cost];
        return React.createElement("div", {
          key: cost,
          style: { marginBottom: 12 }
        },
          // Cost section header
          React.createElement("div", {
            style: {
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 8, paddingBottom: 4,
              borderBottom: "1px solid " + col + "22",
            }
          },
            React.createElement("div", {
              style: {
                width: 22, height: 22, borderRadius: 4,
                background: col + "22", border: "1px solid " + col + "44",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: F.headline, fontWeight: 800, fontSize: 12,
                color: col,
              }
            }, cost),
            React.createElement("span", {
              style: {
                fontSize: 10, fontFamily: F.label, color: col,
                letterSpacing: 2, textTransform: "uppercase", fontWeight: 700,
              }
            }, cost + " Gold"),
            React.createElement("span", {
              style: {
                fontSize: 10, fontFamily: F.body, color: C.textGhost,
              }
            }, group.length + " units")
          ),
          // Champ icons grid
          React.createElement("div", {
            style: { display: "flex", flexWrap: "wrap", gap: 6 }
          },
            group.map(function(champ) {
              return React.createElement(ChampIcon, {
                key: champ.key,
                champ: champ,
                size: 40,
                showName: true,
                selected: selected.includes(champ.key),
                onClick: function() { toggleChamp(champ.key); },
              });
            })
          )
        );
      })
    ),

    // Active traits / synergies
    selected.length > 0 && Object.keys(activeTraitCounts).length > 0 && React.createElement("div", {
      style: {
        background: C.surface, borderRadius: 12,
        border: "1px solid " + C.primary + "33",
        padding: "12px 16px", marginBottom: 16,
      }
    },
      React.createElement("div", {
        style: {
          fontSize: 10, fontFamily: F.label, fontWeight: 700,
          color: C.primary, letterSpacing: 2, textTransform: "uppercase",
          marginBottom: 10,
        }
      }, "Active Synergies"),
      React.createElement("div", {
        style: { display: "flex", flexWrap: "wrap", gap: 8 }
      },
        Object.keys(activeTraitCounts).sort(function(a, b) {
          return activeTraitCounts[b] - activeTraitCounts[a];
        }).map(function(name) {
          var count = activeTraitCounts[name];
          var trait = traitMap[name];
          if (!trait) return null;
          var breakpoints = trait.effects ? trait.effects.map(function(e) { return e.minUnits; }).filter(Boolean) : [];
          var active = breakpoints.some(function(bp) { return bp <= count; });
          var col = TRAIT_COLOR[trait.type] || C.borderLight;

          return React.createElement("div", {
            key: name,
            style: {
              display: "flex", alignItems: "center", gap: 6,
              background: active ? col + "14" : C.surfaceHigh,
              border: "1px solid " + (active ? col + "44" : C.border),
              borderRadius: 8, padding: "5px 10px",
            }
          },
            // Trait name
            React.createElement("span", {
              style: {
                fontSize: 11, fontFamily: F.label, fontWeight: 700,
                color: active ? col : C.textDim, textTransform: "uppercase",
                letterSpacing: 0.5,
              }
            }, name),
            // Breakpoint dots
            breakpoints.length > 0 && React.createElement("div", {
              style: { display: "flex", gap: 3, alignItems: "center" }
            },
              breakpoints.map(function(bp, i) {
                var filled = bp <= count;
                return React.createElement("div", {
                  key: i,
                  title: bp + " units",
                  style: {
                    width: 8, height: 8, borderRadius: "50%",
                    background: filled ? col : "transparent",
                    border: "2px solid " + (filled ? col : col + "55"),
                    transition: "all 0.15s",
                  }
                });
              })
            ),
            // Count badge
            React.createElement("span", {
              style: {
                fontSize: 11, fontFamily: F.label, fontWeight: 800,
                color: active ? col : C.textDim,
                background: active ? col + "22" : C.border + "44",
                padding: "1px 6px", borderRadius: 4,
                minWidth: 18, textAlign: "center",
              }
            }, count)
          );
        })
      )
    ),

    // Comp recommendations
    React.createElement("div", {
      style: { marginBottom: 6 }
    },
      React.createElement("div", {
        style: {
          fontSize: 11, fontFamily: F.label, fontWeight: 700,
          color: C.textDim, letterSpacing: 2, textTransform: "uppercase",
          marginBottom: 12,
        }
      }, selected.length === 0 ? "All Comp Lines" : "Ranked by Match Score"),
      React.createElement("div", {
        style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }
      },
        rankedComps.map(function(comp, idx) {
          var score = selected.length > 0 ? scoreComp(comp, selected, champions) : 0;
          var pct = selected.length > 0 ? Math.round((score / maxScore) * 100) : 0;
          var isBest = selected.length > 0 && idx === 0 && score > 0;
          var isExp = expandedComp === comp.id;
          return React.createElement(CompCard, {
            key: comp.id,
            comp: comp,
            champMap: champMap,
            traitMap: traitMap,
            score: score,
            pct: pct,
            isBest: isBest,
            selectedKeys: selected,
            expanded: isExp,
            onToggle: function() { setExpandedComp(isExp ? null : comp.id); },
          });
        })
      )
    )
  );
}

export default OpenerAdvisor;
