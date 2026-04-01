import React, { useState, useMemo } from "react";
import { C, F, ITEM_TYPE_COLOR } from "../d17.js";
import itemsData from "../data/items_clean.json";
import ItemIcon, { ITEM_MAP } from "../components/ItemIcon.jsx";

var CATEGORY_ORDER = ["component", "combined", "artifact", "emblem", "set17"];
var CATEGORY_LABELS = {
  component: "Components",
  combined:  "Combined Items",
  artifact:  "Artifacts",
  emblem:    "Trait Emblems",
  set17:     "Set 17 Special",
};
var CATEGORY_COLOR = {
  component: "#7dc8ff",
  combined:  "#c8b8ff",
  artifact:  "#f0cc00",
  emblem:    "#ec4899",
  set17:     "#4ade80",
};

var TAG_COLOR = {
  ad:        ITEM_TYPE_COLOR.ad,
  ap:        ITEM_TYPE_COLOR.ap,
  tank:      ITEM_TYPE_COLOR.tank,
  utility:   ITEM_TYPE_COLOR.utility,
  artifact:  ITEM_TYPE_COLOR.artifact,
  emblem:    ITEM_TYPE_COLOR.emblem,
  set17:     "#4ade80",
  special:   "#958da2",
  component: "#7dc8ff",
  combined:  "#c8b8ff",
};

function primaryTag(item) {
  var tags = item.tags || [];
  for (var i = 0; i < tags.length; i++) {
    if (TAG_COLOR[tags[i]]) return tags[i];
  }
  return item.category || "component";
}

function RecipeBuilder(props) {
  var components = itemsData.filter(function(x) { return x.category === "component"; });
  var combined = itemsData.filter(function(x) { return x.category === "combined"; });
  var slotState1 = useState(null);
  var slot1 = slotState1[0];
  var setSlot1 = slotState1[1];
  var slotState2 = useState(null);
  var slot2 = slotState2[0];
  var setSlot2 = slotState2[1];

  var results = useMemo(function() {
    if (!slot1 && !slot2) return [];
    return combined.filter(function(item) {
      if (!item.recipe || item.recipe.length < 2) return false;
      if (slot1 && slot2) {
        return (item.recipe[0] === slot1 && item.recipe[1] === slot2) ||
               (item.recipe[0] === slot2 && item.recipe[1] === slot1);
      }
      var picked = slot1 || slot2;
      return item.recipe.includes(picked);
    });
  }, [slot1, slot2, combined]);

  var slot1Item = slot1 ? ITEM_MAP[slot1] : null;
  var slot2Item = slot2 ? ITEM_MAP[slot2] : null;

  return React.createElement("div", {
    style: {
      background: C.surface,
      border: "1px solid " + C.border,
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 24,
    }
  },
    React.createElement("div", {
      style: {
        display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
      }
    },
      React.createElement("div", {
        style: { height: 1, width: 20, background: C.secondary + "66" }
      }),
      React.createElement("span", {
        style: {
          fontFamily: F.headline, fontSize: 11, fontWeight: 700,
          color: C.secondary, letterSpacing: 3, textTransform: "uppercase",
        }
      }, "Recipe Builder")
    ),
    React.createElement("div", {
      style: {
        fontFamily: F.body, fontSize: 12, color: C.textDim, marginBottom: 16,
      }
    }, "Pick up to 2 components to see what you can craft."),
    React.createElement("div", {
      style: {
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 14, marginBottom: 18, flexWrap: "wrap",
      }
    },
      React.createElement("div", {
        onClick: function() { setSlot1(null); },
        title: slot1Item ? (slot1Item.name + " (click to remove)") : "Slot 1",
        style: {
          width: 52, height: 52, borderRadius: 10,
          border: "2px solid " + (slot1Item ? C.secondary + "88" : C.border),
          background: slot1Item ? C.secondary + "12" : C.surfaceHigh,
          overflow: "hidden", cursor: slot1Item ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "all 0.15s",
          boxShadow: slot1Item ? ("0 0 12px " + C.secondary + "25") : "none",
        }
      },
        slot1Item
          ? React.createElement(ItemIcon, { itemKey: slot1, size: 44 })
          : React.createElement("span", {
              style: { fontSize: 22, color: C.textGhost }
            }, "+")
      ),
      React.createElement("span", {
        style: {
          fontSize: 20, color: C.textDim, fontFamily: F.headline, fontWeight: 700,
        }
      }, "+"),
      React.createElement("div", {
        onClick: function() { setSlot2(null); },
        title: slot2Item ? (slot2Item.name + " (click to remove)") : "Slot 2",
        style: {
          width: 52, height: 52, borderRadius: 10,
          border: "2px solid " + (slot2Item ? C.secondary + "88" : C.border),
          background: slot2Item ? C.secondary + "12" : C.surfaceHigh,
          overflow: "hidden", cursor: slot2Item ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "all 0.15s",
          boxShadow: slot2Item ? ("0 0 12px " + C.secondary + "25") : "none",
        }
      },
        slot2Item
          ? React.createElement(ItemIcon, { itemKey: slot2, size: 44 })
          : React.createElement("span", {
              style: { fontSize: 22, color: C.textGhost }
            }, "+")
      ),
      React.createElement("span", {
        style: {
          fontSize: 20, color: C.textDim, fontFamily: F.headline, fontWeight: 700,
        }
      }, "="),
      React.createElement("div", {
        style: {
          width: 56, height: 56, borderRadius: 12,
          border: "2px solid " + (results.length > 0 ? C.primary + "66" : C.border),
          background: results.length > 0 ? C.primary + "10" : C.surfaceHigh,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "all 0.15s",
          boxShadow: results.length > 0 ? ("0 0 16px " + C.primary + "30") : "none",
        }
      },
        results.length === 1
          ? React.createElement(ItemIcon, { itemKey: results[0].key, size: 46 })
          : React.createElement("span", {
              style: {
                fontSize: results.length > 1 ? 14 : 18,
                color: results.length > 0 ? C.primary : C.textGhost,
                fontFamily: F.headline, fontWeight: 700,
              }
            }, results.length > 1 ? results.length : "?")
      )
    ),
    React.createElement("div", {
      style: {
        display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center",
        marginBottom: results.length > 0 ? 18 : 0,
      }
    },
      components.map(function(comp) {
        var active = slot1 === comp.key || slot2 === comp.key;
        return React.createElement("div", {
          key: comp.key,
          onClick: function() {
            if (active) {
              if (slot1 === comp.key) setSlot1(null);
              else setSlot2(null);
            } else if (!slot1) {
              setSlot1(comp.key);
            } else if (!slot2) {
              setSlot2(comp.key);
            }
          },
          style: {
            cursor: "pointer",
            borderRadius: 6,
            border: active ? ("2px solid " + C.secondary + "66") : "2px solid transparent",
            background: active ? C.secondary + "18" : "transparent",
            padding: 1, transition: "all 0.12s",
          }
        },
          React.createElement(ItemIcon, { itemKey: comp.key, size: 28 })
        );
      })
    ),
    results.length > 0 && React.createElement("div", null,
      React.createElement("div", {
        style: {
          fontFamily: F.label, fontSize: 10, color: C.textMuted,
          letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10,
        }
      }, results.length + " result" + (results.length !== 1 ? "s" : "")),
      React.createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 6,
        }
      },
        results.map(function(item) {
          var col = TAG_COLOR[primaryTag(item)] || C.borderLight;
          return React.createElement("div", {
            key: item.key,
            style: {
              display: "flex", alignItems: "center", gap: 10,
              background: C.surfaceLow, border: "1px solid " + col + "33",
              borderLeft: "3px solid " + col,
              borderRadius: 8, padding: "10px 12px",
              transition: "background 0.12s",
            }
          },
            React.createElement(ItemIcon, { itemKey: item.key, size: 36 }),
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", {
                style: {
                  fontFamily: F.headline, fontSize: 13, fontWeight: 700,
                  color: col, textTransform: "uppercase", letterSpacing: 0.3,
                }
              }, item.name),
              item.desc && React.createElement("div", {
                style: {
                  fontFamily: F.body, fontSize: 11, color: C.textDim,
                  lineHeight: 1.4, marginTop: 3,
                  overflow: "hidden", maxHeight: 32,
                }
              }, item.desc.length > 90 ? (item.desc.slice(0, 90) + "...") : item.desc)
            )
          );
        })
      )
    ),
    (slot1 || slot2) && results.length === 0 && React.createElement("div", {
      style: {
        fontFamily: F.label, fontSize: 12, color: C.textDim,
        textAlign: "center", padding: "16px 0", letterSpacing: 0.5,
      }
    }, "No combined items found for this combination.")
  );
}

function ComponentGrid(props) {
  var items = props.items;
  var expanded = props.expanded;
  var setExpanded = props.setExpanded;

  var expandedItem = expanded ? ITEM_MAP[expanded] : null;
  var expandedCol = expandedItem ? (TAG_COLOR[primaryTag(expandedItem)] || C.borderLight) : null;

  return React.createElement("div", null,
    React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 10,
        marginBottom: expandedItem ? 16 : 0,
      }
    },
      items.map(function(item) {
        var isExp = expanded === item.key;
        var col = TAG_COLOR[primaryTag(item)] || C.borderLight;
        return React.createElement("div", {
          key: item.key,
          onClick: function() { setExpanded(isExp ? null : item.key); },
          style: {
            cursor: "pointer",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 6,
            padding: "10px 4px",
            borderRadius: 10,
            background: isExp ? col + "12" : "transparent",
            border: "1px solid " + (isExp ? col + "44" : "transparent"),
            transition: "all 0.12s",
          }
        },
          React.createElement(ItemIcon, { itemKey: item.key, size: 36, showName: true })
        );
      })
    ),
    expandedItem && React.createElement("div", {
      style: {
        background: C.surface, border: "1px solid " + expandedCol + "44",
        borderLeft: "3px solid " + expandedCol,
        borderRadius: 10, padding: "14px 18px",
      }
    },
      React.createElement("div", {
        style: {
          fontFamily: F.headline, fontSize: 16, fontWeight: 700,
          color: expandedCol, textTransform: "uppercase",
          letterSpacing: -0.3, marginBottom: 6,
        }
      }, expandedItem.name),
      React.createElement("div", {
        style: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }
      },
        (expandedItem.tags || []).map(function(t) {
          var tc = TAG_COLOR[t] || "#494456";
          return React.createElement("span", {
            key: t,
            style: {
              fontSize: 10, background: tc + "18", color: tc,
              padding: "2px 8px", borderRadius: 4,
              fontFamily: F.label, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 0.5,
            }
          }, t);
        })
      ),
      expandedItem.desc && React.createElement("p", {
        style: {
          fontFamily: F.body, fontSize: 12, color: C.textMuted,
          margin: 0, lineHeight: 1.6,
        }
      }, expandedItem.desc)
    )
  );
}

function CombinedItemRow(props) {
  var item = props.item;
  var isExpanded = props.isExpanded;
  var onToggle = props.onToggle;
  var col = TAG_COLOR[primaryTag(item)] || C.borderLight;

  return React.createElement("div", {
    onClick: onToggle,
    style: {
      cursor: "pointer",
      background: isExpanded ? C.surfaceHigh : C.surface,
      border: "1px solid " + (isExpanded ? col + "44" : C.border),
      borderRadius: 10,
      overflow: "hidden",
      transition: "all 0.12s",
    }
  },
    React.createElement("div", {
      style: {
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 14px",
      }
    },
      React.createElement(ItemIcon, { itemKey: item.key, size: 40 }),
      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
        React.createElement("div", {
          style: {
            fontFamily: F.headline, fontSize: 13, fontWeight: 700,
            color: C.text, textTransform: "uppercase", letterSpacing: 0.3,
            marginBottom: 4,
          }
        },
          item.name,
          item.acronym && React.createElement("span", {
            style: {
              fontFamily: F.label, fontSize: 10, color: C.textDim,
              marginLeft: 6, letterSpacing: 1,
            }
          }, "(" + item.acronym + ")")
        ),
        React.createElement("div", {
          style: { display: "flex", flexWrap: "wrap", gap: 3 }
        },
          (item.tags || []).slice(0, 4).map(function(t) {
            var tc = TAG_COLOR[t] || "#494456";
            return React.createElement("span", {
              key: t,
              style: {
                fontSize: 9, background: tc + "18", color: tc,
                padding: "1px 7px", borderRadius: 3,
                fontFamily: F.label, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: 0.5,
              }
            }, t);
          })
        )
      ),
      item.recipe && item.recipe.length > 0 && React.createElement("div", {
        style: {
          display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
        }
      },
        item.recipe.map(function(rk, ri) {
          return React.createElement(ItemIcon, {
            key: ri + "_" + rk, itemKey: rk, size: 20,
          });
        })
      )
    ),
    isExpanded && item.desc && React.createElement("div", {
      style: {
        padding: "8px 14px 12px",
        borderTop: "1px solid " + C.border,
      }
    },
      React.createElement("p", {
        style: {
          fontFamily: F.body, fontSize: 12, color: C.textMuted,
          margin: 0, lineHeight: 1.6,
        }
      }, item.desc)
    )
  );
}

function Items(props) {
  var catState = useState("combined");
  var category = catState[0];
  var setCategory = catState[1];
  var searchState = useState("");
  var search = searchState[0];
  var setSearch = searchState[1];
  var expandedState = useState(null);
  var expanded = expandedState[0];
  var setExpanded = expandedState[1];

  var filtered = useMemo(function() {
    var q = search.toLowerCase().trim();
    return itemsData.filter(function(item) {
      if (item.category !== category) return false;
      if (!q) return true;
      if (item.name.toLowerCase().indexOf(q) >= 0) return true;
      if (item.acronym && item.acronym.toLowerCase().indexOf(q) >= 0) return true;
      if ((item.tags || []).some(function(t) { return t.toLowerCase().indexOf(q) >= 0; })) return true;
      return false;
    });
  }, [category, search]);

  var totalCount = itemsData.length;

  return React.createElement("div", null,
    React.createElement("div", {
      style: {
        position: "relative", overflow: "hidden",
        background: "linear-gradient(160deg, rgba(125,200,255,0.18) 0%, rgba(200,184,255,0.07) 60%, transparent 100%)",
        borderRadius: 16,
        padding: "40px 32px",
        marginBottom: 28,
      }
    },
      React.createElement("div", {
        style: {
          position: "absolute", right: -60, top: -60,
          width: 320, height: 320, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(125,200,255,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }
      }),
      React.createElement("h2", {
        style: {
          fontFamily: F.headline, fontWeight: 700, fontSize: 28,
          textTransform: "uppercase", color: C.text,
          margin: "0 0 8px", lineHeight: 1,
        }
      }, "Items"),
      React.createElement("p", {
        style: {
          fontFamily: F.body, fontSize: 14, color: C.textMuted,
          margin: 0, maxWidth: 520, lineHeight: 1.6,
        }
      }, totalCount + " Set 17 items - components, combined items, artifacts, and emblems.")
    ),
    React.createElement("div", {
      style: {
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 20, flexWrap: "wrap",
      }
    },
      CATEGORY_ORDER.map(function(cat) {
        var active = category === cat;
        var col = CATEGORY_COLOR[cat];
        var count = itemsData.filter(function(x) { return x.category === cat; }).length;
        return React.createElement("button", {
          key: cat,
          onClick: function() { setCategory(cat); setExpanded(null); },
          style: {
            padding: "7px 16px", borderRadius: 8,
            background: active ? col + "22" : "transparent",
            border: "1px solid " + (active ? col : C.border),
            color: active ? col : C.textDim,
            fontFamily: F.headline, fontSize: 11, fontWeight: 700,
            letterSpacing: 1.5, textTransform: "uppercase",
            cursor: "pointer", transition: "all 0.15s",
            boxShadow: active ? ("0 0 10px " + col + "25") : "none",
          }
        },
          CATEGORY_LABELS[cat] + " (" + count + ")"
        );
      }),
      React.createElement("div", { style: { flex: 1 } }),
      React.createElement("input", {
        type: "text",
        value: search,
        onChange: function(e) { setSearch(e.target.value); },
        placeholder: "Search items...",
        style: {
          width: 180, background: C.surface,
          border: "1px solid " + C.border, borderRadius: 8,
          padding: "8px 12px", fontFamily: F.body, fontSize: 13,
          color: C.text, outline: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        },
        onFocus: function(e) {
          e.currentTarget.style.borderColor = C.secondary;
          e.currentTarget.style.boxShadow = "0 0 10px " + C.secondary + "30";
        },
        onBlur: function(e) {
          e.currentTarget.style.borderColor = C.border;
          e.currentTarget.style.boxShadow = "none";
        },
      })
    ),
    category === "component" && React.createElement(RecipeBuilder, null),
    category === "component"
      ? React.createElement(ComponentGrid, {
          items: filtered, expanded: expanded, setExpanded: setExpanded,
        })
      : React.createElement("div", {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 6,
          }
        },
          filtered.map(function(item) {
            return React.createElement(CombinedItemRow, {
              key: item.key,
              item: item,
              isExpanded: expanded === item.key,
              onToggle: function() {
                setExpanded(expanded === item.key ? null : item.key);
              },
            });
          })
        ),
    filtered.length === 0 && React.createElement("div", {
      style: {
        textAlign: "center", padding: "48px 0",
        fontFamily: F.body, fontSize: 14, color: C.textDim,
      }
    }, "No items match your filters.")
  );
}

export default Items;
