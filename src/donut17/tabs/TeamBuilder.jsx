import React, { useState, useMemo } from "react";
import { C, F, COST_COLOR, COST_GLOW, TRAIT_COLOR } from "../d17.js";
import itemsData from "../data/items_clean.json";
import compLinesData from "../data/comp_lines.json";

var h = React.createElement;

// Module-level drag state (avoids stale closure in drop handlers)
var gDrag = { src: null, champ: null, hid: null };

// ── Board constants ───────────────────────────────────────────────────
var ROWS     = 4;
var COLS     = 7;
var HEX_W    = 52;
var HEX_H    = 58;
var COL_STEP = HEX_W + 7;
var ROW_STEP = 78;
var STAGGER  = COL_STEP / 2;
var BOARD_W  = COLS * COL_STEP + STAGGER;
var BOARD_H  = (ROWS - 1) * ROW_STEP + HEX_H + 42;

function hexId(r, c) { return r + "_" + c; }

function makeBoard() {
  var b = {};
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      b[hexId(r, c)] = null;
    }
  }
  return b;
}

function makeSlots() {
  var m = {};
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      m[hexId(r, c)] = [null, null, null];
    }
  }
  return m;
}

function makeStars() {
  var m = {};
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      m[hexId(r, c)] = 1;
    }
  }
  return m;
}

// ── Item helpers ──────────────────────────────────────────────────────
var ITEM_MAP = {};
itemsData.forEach(function(item) { ITEM_MAP[item.key] = item; });

var COMBINED_ITEMS  = itemsData.filter(function(x) { return x.category === "combined"; });
var COMPONENT_ITEMS = itemsData.filter(function(x) { return x.category === "component"; });
var ARTIFACT_ITEMS  = itemsData.filter(function(x) { return x.category === "artifact"; });

// ── HexImage ──────────────────────────────────────────────────────────

function HexImage(props) {
  var champ = props.champ;
  var size = props.size;
  var stateArr = useState(false);
  var err = stateArr[0];
  var setErr = stateArr[1];
  var col = COST_COLOR[champ.cost] || "#6b7280";
  if (!err && champ.assets && champ.assets.face_lg) {
    return h("img", {
      src: champ.assets.face_lg,
      alt: champ.name,
      style: { width: size, height: size, objectFit: "cover", objectPosition: "top center", display: "block" },
      onError: function() { setErr(true); }
    });
  }
  return h("div", {
    style: { width: size, height: size, background: col + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.3, fontFamily: F.label, fontWeight: 700, color: col }
  }, champ.name.slice(0, 2).toUpperCase());
}

// ── ItemSlotImg ───────────────────────────────────────────────────────

function ItemSlotImg(props) {
  var itemKey = props.itemKey;
  var size = props.size;
  var stateArr = useState(false);
  var err = stateArr[0];
  var setErr = stateArr[1];
  var item = ITEM_MAP[itemKey];
  if (!item) return null;
  if (!err && item.icon) {
    return h("img", {
      src: item.icon, alt: item.name, title: item.name,
      style: { width: size, height: size, objectFit: "cover", display: "block" },
      onError: function() { setErr(true); }
    });
  }
  var col = "#7a7490";
  return h("div", {
    style: { width: size, height: size, background: col + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, color: col, fontFamily: F.label, fontWeight: 700 }
  }, (item.acronym || item.name).slice(0, 2).toUpperCase());
}

// ── Pool champion tile ───────────────────────────────────────────────

function PoolChampTile(props) {
  var champ = props.champ;
  var placed = props.placed;
  var onClick = props.onClick;
  var onDragStart = props.onDragStart;
  var stateArr = useState(false);
  var err = stateArr[0];
  var setErr = stateArr[1];
  var col  = COST_COLOR[champ.cost];
  var glow = COST_GLOW[champ.cost];

  var imgContent;
  if (!err && champ.assets && champ.assets.face) {
    imgContent = h("img", {
      src: champ.assets.face, alt: champ.name,
      style: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" },
      onError: function() { setErr(true); }
    });
  } else {
    imgContent = h("div", {
      style: { width: "100%", height: "100%", background: col + "28", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: col, fontFamily: F.label, fontWeight: 700 }
    }, champ.name.slice(0, 2).toUpperCase());
  }

  return h("div", {
    draggable: true,
    onClick: onClick,
    onDragStart: function(e) { onDragStart(e, champ); },
    title: champ.name + " (" + champ.cost + "g)",
    style: {
      cursor: placed ? "default" : "grab",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 3, opacity: placed ? 0.38 : 1,
      transition: "opacity 0.1s, transform 0.15s",
      width: 48, flexShrink: 0,
    }
  },
    h("div", {
      style: {
        width: 40, height: 46,
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        overflow: "hidden",
        outline: "1.5px solid " + col + (placed ? "33" : "77"),
        outlineOffset: 1,
        filter: placed ? "none" : "drop-shadow(0 1px 4px " + glow + ")",
      }
    }, imgContent),
    h("span", {
      style: {
        fontSize: 8, fontFamily: F.label,
        color: placed ? C.textGhost : C.textMuted,
        textAlign: "center", lineHeight: 1.2, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 0.3,
        width: 48, overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap", display: "block",
      }
    }, champ.name)
  );
}

// ── BoardHex ──────────────────────────────────────────────────────────

function BoardHex(props) {
  var hid = props.hid;
  var r = props.r;
  var c = props.c;
  var champ = props.champ;
  var items = props.items;
  var starLevel = props.stars;
  var isSelected = props.selected;
  var pending = props.pending;
  var dragOver = props.dragOver;
  var onClickHex = props.onClickHex;
  var onRemoveItem = props.onRemoveItem;
  var onDragStart = props.onDragStart;
  var onDragOver = props.onDragOver;
  var onDrop = props.onDrop;
  var onDragEnd = props.onDragEnd;

  var stateArr = useState(false);
  var err = stateArr[0];
  var setErr = stateArr[1];
  var isEmpty = !champ;
  var col     = champ ? (COST_COLOR[champ.cost] || "#6b7280") : C.border;
  var glow    = champ ? (COST_GLOW[champ.cost] || "transparent") : "transparent";
  var isOdd   = r % 2 === 1;
  var x       = c * COL_STEP + (isOdd ? 0 : STAGGER);
  var y       = r * ROW_STEP;

  // Star label above hex
  var starStr = "";
  if (starLevel === 2) starStr = "\u2605\u2605";
  if (starLevel === 3) starStr = "\u2605\u2605\u2605";

  // Hex inner content
  var hexContent;
  if (champ) {
    hexContent = h(HexImage, { champ: champ, size: HEX_W - 4 });
  } else {
    hexContent = h("div", {
      style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }
    }, h("span", { style: { fontSize: 16, color: C.border + "88", lineHeight: 1 } }, "+"));
  }

  // Item slot circles
  var itemSlots = null;
  if (champ) {
    itemSlots = h("div", {
      style: { display: "flex", gap: 2, marginTop: 3, justifyContent: "center" }
    }, [0, 1, 2].map(function(si) {
      var itemKey = items[si] || null;
      return h("div", {
        key: si,
        title: itemKey ? (ITEM_MAP[itemKey] ? ITEM_MAP[itemKey].name : itemKey) : "Empty slot",
        onClick: function(e) { e.stopPropagation(); if (itemKey) onRemoveItem(hid, si); },
        style: {
          width: 14, height: 14, borderRadius: "50%",
          border: itemKey ? ("1.5px solid " + col + "99") : ("1px dashed " + C.border),
          background: itemKey ? C.surfaceHigh : C.surfaceLow,
          overflow: "hidden",
          cursor: itemKey ? "pointer" : "default",
          flexShrink: 0,
        }
      }, itemKey ? h(ItemSlotImg, { itemKey: itemKey, size: 14 }) : null);
    }));
  }

  // Name + stars below hex
  var nameBlock = null;
  if (champ) {
    var nameChildren = [
      h("div", {
        key: "name",
        style: { fontFamily: F.label, fontSize: 8, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
      }, champ.name)
    ];
    if (starStr) {
      nameChildren.push(h("div", {
        key: "stars",
        style: { fontSize: 8, color: col, lineHeight: 1, marginTop: 1 }
      }, starStr));
    }
    nameBlock = h("div", {
      style: { marginTop: 3, textAlign: "center", width: HEX_W + 10 }
    }, nameChildren);
  }

  return h("div", {
    draggable: !!champ,
    onDragStart: champ ? function(e) { onDragStart(e, hid, champ); } : undefined,
    onDragOver: function(e) { onDragOver(e, hid); },
    onDrop: function(e) { onDrop(e, hid); },
    onDragEnd: onDragEnd,
    style: { position: "absolute", left: x, top: y, width: HEX_W + 14, display: "flex", flexDirection: "column", alignItems: "center" }
  },
    // Star icons above hex
    champ && starStr ? h("div", {
      style: { fontSize: 9, color: col, textAlign: "center", marginBottom: 2, lineHeight: 1 }
    }, starStr) : null,
    // Hex container
    h("div", {
      onClick: function() { onClickHex(hid); },
      style: {
        width: HEX_W, height: HEX_H,
        cursor: "pointer", position: "relative",
        filter: isSelected ? ("drop-shadow(0 0 8px " + C.primary + "cc)") : champ ? ("drop-shadow(0 0 5px " + glow + ")") : "none",
        transition: "filter 0.15s",
      }
    },
      // Outer hex border
      h("div", {
        style: {
          position: "absolute", inset: -2,
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          background: isSelected ? C.primary + "44" : champ ? col + "22" : "transparent",
          zIndex: 0,
        }
      }),
      // Selection overlay
      h("div", {
        style: {
          position: "absolute", inset: 1,
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          background: isSelected ? C.primary + "33" : "transparent",
          zIndex: 1,
        }
      }),
      // Inner hex with content
      h("div", {
        style: {
          position: "absolute", inset: 2,
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          overflow: "hidden",
          background: isEmpty ? C.surfaceLow : "transparent",
          zIndex: 2,
          outline: isEmpty
            ? ("2px dashed " + (dragOver ? C.secondary : isSelected ? C.primary : C.border))
            : ("2px solid " + (dragOver ? C.secondary : isSelected ? C.primary : col + "88")),
          outlineOffset: -2,
        }
      }, hexContent),
      // Pending overlay
      pending && isEmpty ? h("div", {
        style: {
          position: "absolute", inset: 0,
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          background: C.primary + "1a",
          zIndex: 5,
        }
      }) : null,
      // Cost label
      champ ? h("div", {
        style: {
          position: "absolute", bottom: 3, left: "50%",
          transform: "translateX(-50%)",
          background: col + "ee", padding: "1px 5px",
          fontSize: 7, fontFamily: F.label, fontWeight: 700, color: "#000",
          zIndex: 6, letterSpacing: 0.5,
        }
      }, champ.cost + "G") : null
    ),
    // Name block below hex
    nameBlock,
    // Item slot circles below name
    itemSlots
  );
}

// ── TraitBadge -- hex pip breakpoints, TFT-client style ─────────────────

function TraitBadge(props) {
  var name = props.name;
  var count = props.count;
  var trait = props.trait;
  var breakpoints = trait && trait.effects ? trait.effects.map(function(e) { return e.minUnits; }).filter(Boolean) : [];
  var activeBps   = breakpoints.filter(function(bp) { return bp <= count; });
  var nextBp      = breakpoints.find(function(bp) { return bp > count; });
  var active      = activeBps.length > 0;
  var col         = TRAIT_COLOR[(trait && trait.type) || "class"] || C.borderLight;
  var pct         = nextBp ? Math.min(100, Math.round((count / nextBp) * 100)) : 100;

  // Breakpoint tier color: bronze/silver/gold/chromatic
  var tierCol = col;
  if (activeBps.length >= 4) tierCol = "#e879f9"; // chromatic
  else if (activeBps.length === 3) tierCol = "#facc15"; // gold
  else if (activeBps.length === 2) tierCol = "#c0c0c0"; // silver
  else if (activeBps.length === 1) tierCol = "#cd7f32"; // bronze

  var pipEls = breakpoints.map(function(bp, i) {
    var reached = bp <= count;
    return h("div", {
      key: i,
      style: {
        width: 15, height: 15,
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        background: reached ? tierCol : C.surfaceHighest,
        display: "flex", alignItems: "center", justifyContent: "center",
        outline: "1px solid " + (reached ? tierCol + "77" : C.border),
        outlineOffset: 0,
      }
    }, h("span", {
      style: { fontSize: 6, fontFamily: F.label, fontWeight: 900, color: reached ? "#000" : C.textDim, lineHeight: 1 }
    }, bp));
  });

  var progressBar = null;
  if (active && nextBp) {
    progressBar = h("div", { style: { height: 2, background: C.border } },
      h("div", { style: { height: "100%", width: pct + "%", background: tierCol } })
    );
  }
  if (!active && nextBp) {
    progressBar = h("div", {
      style: { fontSize: 9, color: C.textDim, fontFamily: F.label, marginTop: 1 }
    }, (nextBp - count) + " more for tier 1");
  }

  return h("div", {
    style: {
      display: "flex", alignItems: "center", gap: 7,
      padding: "6px 8px",
      background: active ? tierCol + "10" : "transparent",
      borderLeft: "3px solid " + (active ? tierCol : C.border + "55"),
      marginBottom: 1,
    }
  },
    // Count hex
    h("div", {
      style: {
        width: 22, height: 22, flexShrink: 0,
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        background: active ? tierCol + "28" : C.surfaceHighest,
        display: "flex", alignItems: "center", justifyContent: "center",
        outline: "1.5px solid " + (active ? tierCol + "88" : C.border),
        outlineOffset: 0,
      }
    }, h("span", {
      style: { fontSize: 10, fontFamily: F.label, fontWeight: 900, color: active ? tierCol : C.textDim, lineHeight: 1 }
    }, count)),
    // Name + pips + progress
    h("div", { style: { flex: 1, minWidth: 0 } },
      h("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: (active && nextBp) ? 3 : 0 }
      },
        h("span", {
          style: {
            fontSize: 11, fontFamily: F.label, fontWeight: 700,
            color: active ? tierCol : C.textDim,
            textTransform: "uppercase", letterSpacing: 0.3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80,
          }
        }, name),
        h("div", { style: { display: "flex", gap: 2, flexShrink: 0 } }, pipEls)
      ),
      progressBar
    )
  );
}

// ── ItemPickerIcon ─────────────────────────────────────────────────────

function ItemPickerIcon(props) {
  var item = props.item;
  var onClick = props.onClick;
  var stateArr = useState(false);
  var err = stateArr[0];
  var setErr = stateArr[1];

  var content;
  if (!err && item.icon) {
    content = h("img", {
      src: item.icon, alt: item.name,
      style: { width: "100%", height: "100%", objectFit: "cover" },
      onError: function() { setErr(true); }
    });
  } else {
    content = h("div", {
      style: { width: "100%", height: "100%", background: C.surfaceLow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: C.textDim, fontFamily: F.label, fontWeight: 700 }
    }, (item.acronym || item.name).slice(0, 2).toUpperCase());
  }

  return h("div", {
    onClick: onClick,
    title: item.name + (item.acronym ? " (" + item.acronym + ")" : ""),
    style: {
      width: 34, height: 34,
      border: "1px solid " + C.border,
      background: C.surfaceHigh,
      overflow: "hidden", cursor: "pointer", flexShrink: 0,
      transition: "border-color 0.1s, filter 0.1s",
    },
    onMouseEnter: function(e) { e.currentTarget.style.borderColor = C.secondary; e.currentTarget.style.filter = "brightness(1.3)"; },
    onMouseLeave: function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.filter = "none"; }
  }, content);
}

// ── Main component ────────────────────────────────────────────────────

function TeamBuilder(props) {
  var champions = props.champions;
  var traits = props.traits;

  var boardState = useState(makeBoard);
  var board = boardState[0];
  var setBoard = boardState[1];

  var slotsState = useState(makeSlots);
  var slots = slotsState[0];
  var setSlots = slotsState[1];

  var starsState = useState(makeStars);
  var starsMap = starsState[0];
  var setStars = starsState[1];

  var selState = useState(null);
  var selected = selState[0];
  var setSelected = selState[1];

  var pendState = useState(null);
  var pendingChamp = pendState[0];
  var setPendingChamp = pendState[1];

  var cfState = useState([1, 2, 3, 4, 5]);
  var costFilter = cfState[0];
  var setCostFilter = cfState[1];

  var searchState = useState("");
  var search = searchState[0];
  var setSearch = searchState[1];

  var itState = useState("combined");
  var itemTab = itState[0];
  var setItemTab = itState[1];

  var histState = useState([]);
  var history = histState[0];
  var setHistory = histState[1];

  var doState = useState(null);
  var dragOverHid = doState[0];
  var setDragOverHid = doState[1];

  // ── Drag handlers ──
  function handlePoolDragStart(e, champ) {
    gDrag = { src: "pool", champ: champ, hid: null };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", champ.key);
  }

  function handleBoardDragStart(e, hid, champ) {
    gDrag = { src: "board", champ: champ, hid: hid };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", hid);
  }

  function handleHexDragOver(e, hid) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverHid(hid);
  }

  function handleHexDrop(e, targetHid) {
    e.preventDefault();
    setDragOverHid(null);
    if (!gDrag.src) return;
    saveHistory();
    if (gDrag.src === "pool") {
      var champToDrop = gDrag.champ;
      setBoard(function(prev) {
        var next = Object.assign({}, prev);
        next[targetHid] = champToDrop;
        return next;
      });
      setSelected(targetHid);
    } else if (gDrag.src === "board" && gDrag.hid !== targetHid) {
      var srcHid = gDrag.hid;
      setBoard(function(prev) {
        var next = Object.assign({}, prev);
        var srcChamp = next[srcHid];
        var tgtChamp = next[targetHid];
        next[targetHid] = srcChamp;
        next[srcHid] = tgtChamp;
        return next;
      });
      setSelected(targetHid);
    }
    gDrag = { src: null, champ: null, hid: null };
  }

  function handleDragEnd() {
    setDragOverHid(null);
    gDrag = { src: null, champ: null, hid: null };
  }

  function handlePoolAreaDrop(e) {
    e.preventDefault();
    if (gDrag.src === "board" && gDrag.hid) {
      saveHistory();
      var removeHid = gDrag.hid;
      setBoard(function(prev) {
        var next = Object.assign({}, prev);
        next[removeHid] = null;
        return next;
      });
      if (selected === removeHid) setSelected(null);
    }
    setDragOverHid(null);
    gDrag = { src: null, champ: null, hid: null };
  }

  // ── Memos ──
  var traitMap = useMemo(function() {
    var m = {};
    traits.forEach(function(t) { m[t.name] = t; });
    return m;
  }, [traits]);

  var champByKey = useMemo(function() {
    var m = {};
    champions.forEach(function(c) { m[c.key] = c; });
    return m;
  }, [champions]);

  var traitOptions = useMemo(function() {
    var names = [];
    traits.filter(function(t) { return t.type === "origin" || t.type === "class"; })
      .sort(function(a, b) { return a.name.localeCompare(b.name); })
      .forEach(function(t) { names.push(t.name); });
    return names;
  }, [traits]);

  var boardChampCounts = useMemo(function() {
    var m = {};
    Object.values(board).forEach(function(c) {
      if (c) m[c.key] = (m[c.key] || 0) + 1;
    });
    return m;
  }, [board]);

  var poolChamps = useMemo(function() {
    var q = search.toLowerCase().trim();
    return champions.filter(function(c) {
      if (costFilter.indexOf(c.cost) === -1) return false;
      if (!q) return true;
      if (c.name.toLowerCase().indexOf(q) !== -1) return true;
      if (c.traits.some(function(t) { return t.toLowerCase().indexOf(q) !== -1; })) return true;
      return false;
    });
  }, [champions, costFilter, search]);

  var traitCounts = useMemo(function() {
    var counts = {};
    Object.values(board).forEach(function(champ) {
      if (!champ) return;
      champ.traits.forEach(function(t) {
        if (t !== "Choose Trait") counts[t] = (counts[t] || 0) + 1;
      });
    });
    return counts;
  }, [board]);

  var sortedTraits = useMemo(function() {
    return Object.entries(traitCounts).sort(function(a, b) {
      var ta = traitMap[a[0]];
      var tb = traitMap[b[0]];
      var bpsA = ta && ta.effects ? ta.effects.map(function(e) { return e.minUnits; }).filter(Boolean) : [];
      var bpsB = tb && tb.effects ? tb.effects.map(function(e) { return e.minUnits; }).filter(Boolean) : [];
      var actA = bpsA.filter(function(bp) { return bp <= a[1]; }).length;
      var actB = bpsB.filter(function(bp) { return bp <= b[1]; }).length;
      if (actB !== actA) return actB - actA;
      return b[1] - a[1];
    });
  }, [traitCounts, traitMap]);

  var boardCount = Object.values(board).filter(Boolean).length;
  var totalGold  = Object.values(board).filter(Boolean).reduce(function(sum, c) { return sum + c.cost; }, 0);
  var selectedChamp = selected ? board[selected] : null;

  var activeTraitCount = sortedTraits.filter(function(e) {
    var t = traitMap[e[0]];
    var bps = t && t.effects ? t.effects.map(function(ef) { return ef.minUnits; }).filter(Boolean) : [];
    return bps.some(function(bp) { return bp <= e[1]; });
  }).length;

  // ── Actions ──
  function saveHistory() {
    setHistory(function(prev) {
      return prev.slice(-19).concat({ board: Object.assign({}, board), slots: JSON.parse(JSON.stringify(slots)), stars: Object.assign({}, starsMap) });
    });
  }

  function handleClickHex(hid) {
    if (pendingChamp) {
      if (!board[hid]) {
        saveHistory();
        setBoard(function(prev) { var next = Object.assign({}, prev); next[hid] = pendingChamp; return next; });
        setPendingChamp(null);
        setSelected(hid);
        return;
      }
    }
    if (board[hid]) {
      setSelected(selected === hid ? null : hid);
    } else {
      setSelected(null);
    }
  }

  function handlePoolClick(champ) {
    setPendingChamp(champ);
    var keys = Object.keys(board);
    for (var i = 0; i < keys.length; i++) {
      if (!board[keys[i]]) {
        saveHistory();
        setBoard(function(prev) { var next = Object.assign({}, prev); next[keys[i]] = champ; return next; });
        setSelected(keys[i]);
        setPendingChamp(null);
        return;
      }
    }
    setPendingChamp(null);
  }

  function handleRemoveChamp(hid) {
    if (!board[hid]) return;
    saveHistory();
    setBoard(function(prev) { var next = Object.assign({}, prev); next[hid] = null; return next; });
    setSlots(function(prev) {
      var next = JSON.parse(JSON.stringify(prev));
      next[hid] = [null, null, null];
      return next;
    });
    if (selected === hid) setSelected(null);
  }

  function handleRemoveItem(hid, slotIdx) {
    setSlots(function(prev) {
      var next = JSON.parse(JSON.stringify(prev));
      next[hid][slotIdx] = null;
      return next;
    });
  }

  function handleAssignItem(itemKey) {
    if (!selected || !board[selected]) return;
    setSlots(function(prev) {
      var next = JSON.parse(JSON.stringify(prev));
      var sl = next[selected];
      var emptyIdx = sl.findIndex(function(x) { return x === null; });
      if (emptyIdx !== -1) sl[emptyIdx] = itemKey;
      return next;
    });
  }

  function cycleStars(hid) {
    if (!board[hid]) return;
    setStars(function(prev) {
      var next = Object.assign({}, prev);
      next[hid] = next[hid] >= 3 ? 1 : next[hid] + 1;
      return next;
    });
  }

  function handleUndo() {
    if (!history.length) return;
    var last = history[history.length - 1];
    setBoard(last.board);
    setSlots(last.slots);
    setStars(last.stars);
    setHistory(function(prev) { return prev.slice(0, -1); });
    setSelected(null);
  }

  function handleClear() {
    saveHistory();
    setBoard(makeBoard());
    setSlots(makeSlots());
    setStars(makeStars());
    setSelected(null);
  }

  function handleLoadComp(compId) {
    var comp = compLinesData.find(function(c) { return c.id === compId; });
    if (!comp) return;
    saveHistory();
    var next = makeBoard();
    var nextSlots = makeSlots();
    var allUnits = (comp.core || []).concat(comp.flex || []);
    var keys = Object.keys(next);
    var ci = 0;
    allUnits.forEach(function(key) {
      var champ = champByKey[key];
      if (!champ) return;
      while (ci < keys.length && next[keys[ci]] !== null) ci++;
      if (ci < keys.length) {
        next[keys[ci]] = champ;
        if (comp.items && comp.items[key]) {
          var itemKeys = comp.items[key];
          for (var si = 0; si < Math.min(3, itemKeys.length); si++) {
            nextSlots[keys[ci]][si] = itemKeys[si];
          }
        }
        ci++;
      }
    });
    setBoard(next);
    setSlots(nextSlots);
    setSelected(null);
  }

  var currentItemList = itemTab === "combined" ? COMBINED_ITEMS
    : itemTab === "components" ? COMPONENT_ITEMS
    : ARTIFACT_ITEMS;

  // ── RENDER ─────────────────────────────────────────────────────────

  // Hero section
  var hero = h("div", {
    style: {
      position: "relative", overflow: "hidden",
      background: "linear-gradient(160deg, rgba(200,184,255,0.12) 0%, rgba(200,184,255,0.04) 60%, transparent 100%)",
      borderRadius: 16,
      border: "1px solid " + C.border,
      padding: "28px 32px 24px",
      marginBottom: 24,
    }
  },
    h("div", {
      style: { position: "absolute", right: -40, top: -40, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,184,255,0.08) 0%, transparent 70%)", pointerEvents: "none" }
    }),
    h("div", {
      style: { fontSize: 10, fontFamily: F.headline, fontWeight: 700, color: C.primary, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }
    }, "Set 17 - Space Gods"),
    h("h2", {
      style: { fontFamily: F.headline, fontWeight: 900, fontSize: 28, textTransform: "uppercase", letterSpacing: -0.5, color: C.text, lineHeight: 1, margin: "0 0 10px" }
    }, "Team Builder"),
    h("p", {
      style: { fontFamily: F.body, fontSize: 12, color: C.textDim, margin: 0, maxWidth: 480, lineHeight: 1.6 }
    }, "Click or drag units from the pool onto the board. Drag to swap positions. Select a unit to equip items.")
  );

  // Controls row
  var compOptions = compLinesData.map(function(comp) {
    return h("option", { key: comp.id, value: comp.id }, comp.name);
  });

  var controlsRow = h("div", {
    style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }
  },
    h("select", {
      defaultValue: "",
      onChange: function(e) { if (e.target.value) { handleLoadComp(e.target.value); e.target.value = ""; } },
      style: { padding: "6px 10px", background: C.surfaceHigh, border: "1px solid " + C.border, color: C.textMuted, fontFamily: F.label, fontSize: 10, outline: "none", cursor: "pointer" }
    }, h("option", { value: "" }, "Load Comp..."), compOptions),
    h("button", {
      onClick: handleUndo,
      disabled: !history.length,
      style: { padding: "6px 14px", background: "transparent", border: "1px solid " + C.border, color: history.length ? C.textMuted : C.border, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", cursor: history.length ? "pointer" : "default" }
    }, "UNDO"),
    h("button", {
      onClick: handleClear,
      style: { padding: "6px 14px", background: C.error + "15", border: "1px solid " + C.error + "55", color: C.error, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }
    }, "CLEAR"),
    // Board stats inline
    boardCount > 0 ? h("div", {
      style: { display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", padding: "6px 12px", background: C.surfaceLow, flexWrap: "wrap" }
    },
      h("span", { style: { fontFamily: F.label, fontSize: 11, fontWeight: 700, color: C.primary } },
        boardCount, h("span", { style: { color: C.textDim, fontWeight: 400 } }, "/28")
      ),
      h("span", { style: { fontFamily: F.label, fontSize: 11, fontWeight: 700, color: C.tertiary } }, totalGold + "g"),
      h("span", { style: { fontFamily: F.label, fontSize: 10, color: C.success } }, activeTraitCount + " synergies"),
      selected && selectedChamp ? h("div", {
        style: { display: "flex", gap: 6, alignItems: "center", borderLeft: "1px solid " + C.border, paddingLeft: 10 }
      },
        h("span", { style: { fontSize: 11, fontFamily: F.label, color: C.primary, fontWeight: 700 } }, selectedChamp.name),
        h("button", {
          onClick: function() { cycleStars(selected); },
          style: { fontSize: 10, background: "transparent", border: "1px solid " + C.tertiary + "55", color: C.tertiary, padding: "1px 8px", cursor: "pointer", fontFamily: F.label, fontWeight: 700 }
        }, "\u2605".repeat(starsMap[selected])),
        h("button", {
          onClick: function() { handleRemoveChamp(selected); },
          style: { fontSize: 9, background: C.error + "12", border: "1px solid " + C.error + "44", color: C.error, padding: "1px 8px", cursor: "pointer", fontFamily: F.label, fontWeight: 700, letterSpacing: 1 }
        }, "REMOVE")
      ) : null
    ) : null
  );

  // ── LEFT: Synergies panel ──
  var synergiesContent;
  if (sortedTraits.length === 0) {
    synergiesContent = h("div", { style: { padding: "24px 12px", textAlign: "center" } },
      h("div", { style: { fontSize: 11, color: C.textDim, fontFamily: F.body, fontStyle: "italic", lineHeight: 1.6 } }, "Place units on the board to see trait synergies")
    );
  } else {
    synergiesContent = h("div", { style: { padding: "4px 0" } },
      sortedTraits.map(function(entry) {
        return h(TraitBadge, { key: entry[0], name: entry[0], count: entry[1], trait: traitMap[entry[0]] });
      })
    );
  }

  var leftPanel = h("div", { style: { width: 220, flexShrink: 0 } },
    h("div", { style: { background: C.surfaceLow, border: "1px solid " + C.border } },
      h("div", {
        style: { padding: "10px 12px 8px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between" }
      },
        h("span", { style: { fontSize: 10, fontFamily: F.label, fontWeight: 700, color: C.textDim, letterSpacing: 2, textTransform: "uppercase" } }, "Synergies"),
        activeTraitCount > 0 ? h("span", { style: { fontSize: 10, fontFamily: F.label, color: C.success, fontWeight: 700 } }, activeTraitCount + " active") : null
      ),
      synergiesContent
    )
  );

  // ── CENTER: Board + Pool ──
  // Board dots
  var boardDots = [];
  for (var dr = 0; dr < ROWS; dr++) {
    for (var dc = 0; dc < COLS; dc++) {
      var dIsOdd = dr % 2 === 1;
      var dbx = dc * COL_STEP + (dIsOdd ? 0 : STAGGER) + HEX_W / 2;
      var dby = dr * ROW_STEP + HEX_H / 2;
      boardDots.push(h("div", {
        key: dr + "_" + dc + "_dot",
        style: {
          position: "absolute", left: dbx - 1, top: dby - 1,
          width: 2, height: 2,
          background: C.border + "55", borderRadius: "50%",
          pointerEvents: "none",
        }
      }));
    }
  }

  // Board hexes
  var boardHexes = [];
  for (var hr = 0; hr < ROWS; hr++) {
    for (var hc = 0; hc < COLS; hc++) {
      var hid2 = hexId(hr, hc);
      var bChamp = board[hid2];
      boardHexes.push(h(BoardHex, {
        key: hid2,
        hid: hid2, r: hr, c: hc,
        champ: bChamp,
        items: slots[hid2],
        stars: starsMap[hid2],
        selected: selected === hid2,
        pending: !!pendingChamp && !bChamp,
        dragOver: dragOverHid === hid2,
        onClickHex: handleClickHex,
        onRemoveItem: handleRemoveItem,
        onDragStart: handleBoardDragStart,
        onDragOver: handleHexDragOver,
        onDrop: handleHexDrop,
        onDragEnd: handleDragEnd,
      }));
    }
  }

  // Pool cost rows
  var poolRows = [1, 2, 3, 4, 5].filter(function(cost) { return costFilter.indexOf(cost) !== -1; }).map(function(cost) {
    var group = poolChamps.filter(function(c) { return c.cost === cost; });
    if (!group.length) return null;
    var pCol = COST_COLOR[cost];
    return h("div", { key: cost, style: { marginBottom: 4 } },
      h("div", { style: { padding: "2px 10px 4px", display: "flex", alignItems: "center", gap: 6 } },
        h("div", { style: { height: 1, width: 8, background: pCol + "66" } }),
        h("span", { style: { fontSize: 9, fontFamily: F.label, color: pCol, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" } }, cost + "G"),
        h("div", { style: { height: 1, flex: 1, background: pCol + "22" } })
      ),
      h("div", { style: { display: "flex", gap: 6, padding: "0 10px", flexWrap: "wrap" } },
        group.map(function(champ) {
          return h(PoolChampTile, {
            key: champ.key,
            champ: champ,
            placed: boardChampCounts[champ.key] || 0,
            onClick: function() { handlePoolClick(champ); },
            onDragStart: handlePoolDragStart,
          });
        })
      )
    );
  });

  // Cost filter buttons
  var costButtons = [1, 2, 3, 4, 5].map(function(cost) {
    var isActive = costFilter.indexOf(cost) !== -1;
    var cCol = COST_COLOR[cost];
    return h("button", {
      key: cost,
      onClick: function() {
        setCostFilter(function(prev) {
          return isActive ? prev.filter(function(c) { return c !== cost; }) : prev.concat(cost).sort();
        });
      },
      style: { width: 24, height: 24, border: "1px solid " + (isActive ? cCol : C.border), background: isActive ? cCol + "22" : "transparent", color: isActive ? cCol : C.textDim, fontSize: 10, fontFamily: F.label, fontWeight: 700, cursor: "pointer" }
    }, cost);
  });

  var centerPanel = h("div", { style: { flex: 1, minWidth: 0 } },
    // Board header
    h("div", {
      style: { background: C.surfaceLow, padding: "6px 12px", marginBottom: 3, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid " + C.border, borderBottom: "none" }
    },
      h("span", { style: { fontSize: 10, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase" } }, "Board"),
      h("span", { style: { fontSize: 10, fontFamily: F.label, color: boardCount > 0 ? C.primary : C.textDim } }, boardCount + "/" + (ROWS * COLS) + " units"),
      pendingChamp ? h("span", { style: { fontSize: 10, fontFamily: F.label, color: C.secondary, letterSpacing: 0.5 } }, "Placing " + pendingChamp.name + " - click a hex") : null
    ),
    // Hex board area
    h("div", {
      style: {
        background: "radial-gradient(ellipse at 50% 60%, " + C.surfaceHigh + " 0%, " + C.surfaceLow + " 100%)",
        border: "1px solid " + C.border,
        padding: "16px 20px 12px",
        overflowX: "auto",
        marginBottom: 10,
      }
    },
      h("div", { style: { position: "relative", width: BOARD_W, height: BOARD_H, margin: "0 auto" } },
        boardDots, boardHexes
      )
    ),
    // Champion Pool
    h("div", {
      style: { background: C.surfaceLow, border: "1px solid " + C.border },
      onDragOver: function(e) { e.preventDefault(); },
      onDrop: handlePoolAreaDrop,
    },
      // Pool controls
      h("div", {
        style: { padding: "8px 10px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", gap: 8 }
      },
        h("span", { style: { fontSize: 10, fontFamily: F.label, fontWeight: 700, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", flexShrink: 0 } }, "Pool"),
        h("input", {
          value: search,
          onChange: function(e) { setSearch(e.target.value); },
          placeholder: "Search...",
          style: { padding: "4px 8px", background: C.surfaceHigh, border: "1px solid " + C.border, color: C.text, fontSize: 11, fontFamily: F.label, outline: "none", width: 120 }
        }),
        h("div", { style: { display: "flex", gap: 3 } }, costButtons)
      ),
      // Pool rows by cost
      h("div", { style: { padding: "6px 0" } },
        poolRows,
        poolChamps.length === 0 ? h("div", { style: { padding: "16px 12px", fontSize: 11, color: C.textDim, fontFamily: F.label, textAlign: "center" } }, "No units match") : null
      )
    )
  );

  // ── RIGHT: Items Panel ──
  var itemDetailHeader;
  if (selected && selectedChamp) {
    var eqSlots = [0, 1, 2].map(function(si) {
      var itemKey = slots[selected][si];
      return h("div", {
        key: si,
        onClick: function() { if (itemKey) handleRemoveItem(selected, si); },
        title: itemKey && ITEM_MAP[itemKey] ? ITEM_MAP[itemKey].name + " (click to remove)" : "Empty slot",
        style: {
          width: 34, height: 34,
          border: "1px solid " + (itemKey ? C.primary + "66" : C.border),
          background: C.surfaceHigh, overflow: "hidden",
          cursor: itemKey ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center",
        }
      }, itemKey ? h(ItemSlotImg, { itemKey: itemKey, size: 34 }) : h("span", { style: { fontSize: 14, color: C.border } }, "+"));
    });

    var portraitContent = null;
    if (selectedChamp.assets && selectedChamp.assets.face) {
      portraitContent = h("img", {
        src: selectedChamp.assets.face, alt: selectedChamp.name,
        style: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }
      });
    }

    itemDetailHeader = h("div", { style: { borderBottom: "1px solid " + C.border, padding: "10px 12px" } },
      h("div", { style: { fontSize: 10, fontFamily: F.label, fontWeight: 700, color: C.primary, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" } },
        "Equipping - " + selectedChamp.name
      ),
      h("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
        h("div", {
          style: {
            width: 40, height: 44,
            clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            overflow: "hidden",
            outline: "1.5px solid " + COST_COLOR[selectedChamp.cost] + "88",
            flexShrink: 0,
          }
        }, portraitContent),
        h("div", { style: { flex: 1 } },
          h("div", { style: { fontFamily: F.headline, fontSize: 14, fontWeight: 700, color: COST_COLOR[selectedChamp.cost], textTransform: "uppercase", letterSpacing: 0.5 } }, selectedChamp.name),
          h("div", { style: { fontSize: 9, fontFamily: F.label, color: C.textDim } }, selectedChamp.cost + "G")
        ),
        h("div", { style: { display: "flex", gap: 4 } }, eqSlots)
      )
    );
  } else {
    itemDetailHeader = h("div", { style: { padding: "10px 12px", borderBottom: "1px solid " + C.border } },
      h("span", { style: { fontSize: 10, fontFamily: F.label, fontWeight: 700, color: C.textDim, letterSpacing: 2, textTransform: "uppercase" } }, "Items"),
      h("div", { style: { fontSize: 9, fontFamily: F.label, color: C.textDim, marginTop: 4, fontStyle: "italic" } }, "Select a unit to equip items")
    );
  }

  // Item tabs
  var itemTabs = [["combined", "BIS"], ["components", "Parts"], ["artifact", "Artifacts"]].map(function(pair) {
    var id = pair[0];
    var label = pair[1];
    var isActive = itemTab === id;
    return h("button", {
      key: id,
      onClick: function() { setItemTab(id); },
      style: {
        flex: 1, padding: "7px 0",
        fontSize: 9, fontFamily: F.label, fontWeight: 700,
        background: isActive ? C.secondary + "18" : "transparent",
        border: "none",
        borderBottom: isActive ? ("2px solid " + C.secondary) : "2px solid transparent",
        color: isActive ? C.secondary : C.textDim,
        cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase",
      }
    }, label);
  });

  // Item grid
  var itemGrid = currentItemList.map(function(item) {
    return h(ItemPickerIcon, {
      key: item.key,
      item: item,
      onClick: function() { handleAssignItem(item.key); }
    });
  });

  var rightPanel = h("div", { style: { width: 260, flexShrink: 0 } },
    h("div", { style: { background: C.surfaceLow, border: "1px solid " + C.border } },
      itemDetailHeader,
      h("div", { style: { display: "flex", borderBottom: "1px solid " + C.border } }, itemTabs),
      h("div", { style: { padding: "10px", display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 480, overflowY: "auto" } }, itemGrid)
    )
  );

  // ── Main layout ──
  return h("div", null,
    hero,
    controlsRow,
    h("div", { style: { display: "flex", gap: 10, alignItems: "flex-start" } },
      leftPanel,
      centerPanel,
      rightPanel
    )
  );
}

export default TeamBuilder;
