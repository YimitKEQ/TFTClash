import React, { useState, useMemo, useCallback } from "react";
import { C, F, COST_COLOR, COST_GLOW, TRAIT_COLOR } from "../d17.js";
import itemsData from "../data/items_clean.json";
import compLinesData from "../data/comp_lines.json";

// Module-level drag state (avoids stale closure in drop handlers)
var gDrag = { src: null, champ: null, hid: null };

// ── Board constants ───────────────────────────────────────────────────
const ROWS = 4;
const COLS = 7;
const HEX_W  = 66;
const HEX_H  = 72;
const COL_STEP = HEX_W + 7;
const ROW_STEP = 95;       // hex + space for name + items below
const STAGGER  = COL_STEP / 2;
const BOARD_W  = COLS * COL_STEP + STAGGER;
const BOARD_H  = (ROWS - 1) * ROW_STEP + HEX_H + 42;  // + items area

function hexId(r, c) { return r + "_" + c; }

function makeBoard() {
  const b = {};
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      b[hexId(r, c)] = null;
    }
  }
  return b;
}

function makeSlots() {
  const m = {};
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      m[hexId(r, c)] = [null, null, null];
    }
  }
  return m;
}

function makeStars() {
  const m = {};
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      m[hexId(r, c)] = 1;
    }
  }
  return m;
}

// ── Item helpers ──────────────────────────────────────────────────────
const ITEM_MAP = {};
itemsData.forEach(function(item) { ITEM_MAP[item.key] = item; });

// combined + components for quick access
const COMBINED_ITEMS  = itemsData.filter(function(x) { return x.category === "combined"; });
const COMPONENT_ITEMS = itemsData.filter(function(x) { return x.category === "component"; });
const ARTIFACT_ITEMS  = itemsData.filter(function(x) { return x.category === "artifact"; });

// ── Sub-components ────────────────────────────────────────────────────

function HexImage({ champ, size }) {
  const [err, setErr] = useState(false);
  const col = COST_COLOR[champ.cost] || "#6b7280";
  if (!err && champ.assets && champ.assets.face_lg) {
    return (
      <img
        src={champ.assets.face_lg}
        alt={champ.name}
        style={{ width: size, height: size, objectFit: "cover", objectPosition: "top center", display: "block" }}
        onError={function() { setErr(true); }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, background: col + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.3, fontFamily: F.label, fontWeight: 700, color: col }}>
      {champ.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function ItemSlotImg({ itemKey, size }) {
  const [err, setErr] = useState(false);
  const item = ITEM_MAP[itemKey];
  if (!item) return null;
  if (!err && item.icon) {
    return (
      <img src={item.icon} alt={item.name} title={item.name} style={{ width: size, height: size, objectFit: "cover", display: "block" }} onError={function() { setErr(true); }} />
    );
  }
  const col = "#7a7490";
  return (
    <div style={{ width: size, height: size, background: col + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, color: col, fontFamily: F.label, fontWeight: 700 }}>
      {(item.acronym || item.name).slice(0, 2).toUpperCase()}
    </div>
  );
}

function PoolIcon({ champ, placed, onClick, onDragStart }) {
  const [err, setErr] = useState(false);
  const col = COST_COLOR[champ.cost];
  const glow = COST_GLOW[champ.cost];
  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={function(e) { onDragStart(e, champ); }}
      title={champ.name + " (" + champ.cost + "g)"}
      style={{
        cursor: "grab",
        width: 42,
        height: 46,
        position: "relative",
        opacity: placed ? 0.35 : 1,
        transition: "opacity 0.1s, filter 0.1s",
        filter: placed ? "none" : "drop-shadow(0 1px 3px " + glow + ")",
      }}
    >
      <div style={{
        width: 42,
        height: 46,
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        overflow: "hidden",
        outline: "1.5px solid " + col + "66",
        outlineOffset: 1,
      }}>
        {!err && champ.assets && champ.assets.face ? (
          <img src={champ.assets.face} alt={champ.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }} onError={function() { setErr(true); }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: col + "28", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: col, fontFamily: F.label, fontWeight: 700 }}>
            {champ.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      {placed > 0 && (
        <div style={{ position: "absolute", top: 1, right: -2, width: 13, height: 13, background: col, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontFamily: F.label, fontWeight: 900, color: "#000", borderRadius: 0 }}>
          {placed}
        </div>
      )}
    </div>
  );
}

function BoardHex({ hid, r, c, champ, items, stars, selected, pending, dragOver, onClickHex, onRemoveItem, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [err, setErr] = useState(false);
  const isEmpty = !champ;
  const col     = champ ? (COST_COLOR[champ.cost] || "#6b7280") : C.border;
  const glow    = champ ? (COST_GLOW[champ.cost] || "transparent") : "transparent";
  const isOdd   = r % 2 === 1;
  const x       = c * COL_STEP + (isOdd ? 0 : STAGGER);
  const y       = r * ROW_STEP;

  const starLabel = stars === 2 ? "★★" : stars === 3 ? "★★★" : "";

  return (
    <div
      draggable={!!champ}
      onDragStart={champ ? function(e) { onDragStart(e, hid, champ); } : undefined}
      onDragOver={function(e) { onDragOver(e, hid); }}
      onDrop={function(e) { onDrop(e, hid); }}
      onDragEnd={onDragEnd}
      style={{ position: "absolute", left: x, top: y, width: HEX_W + 14, display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      {/* Hex cell */}
      <div
        onClick={function() { onClickHex(hid); }}
        style={{
          width: HEX_W,
          height: HEX_H,
          cursor: "pointer",
          position: "relative",
          filter: selected ? ("drop-shadow(0 0 8px " + C.primary + "cc)") : champ ? ("drop-shadow(0 0 5px " + glow + ")") : "none",
          transition: "filter 0.15s",
        }}
      >
        {/* Hex background (glow ring) */}
        <div style={{
          position: "absolute",
          inset: -2,
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          background: selected ? C.primary + "44" : champ ? col + "22" : "transparent",
          zIndex: 0,
        }} />
        {/* Hex border */}
        <div style={{
          position: "absolute",
          inset: 1,
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          background: selected ? C.primary + "33" : "transparent",
          border: "none",
          zIndex: 1,
        }} />
        {/* Hex content */}
        <div style={{
          position: "absolute",
          inset: 2,
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          overflow: "hidden",
          background: isEmpty ? C.surfaceLow : "transparent",
          zIndex: 2,
          outline: "2px solid " + (dragOver ? C.secondary : selected ? C.primary : isEmpty ? C.border : col + "88"),
          outlineOffset: -2,
        }}>
          {champ ? (
            <HexImage champ={champ} size={HEX_W - 4} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 20, color: C.border, lineHeight: 1 }}>+</span>
            </div>
          )}
        </div>

        {/* Pending flash */}
        {pending && isEmpty && (
          <div style={{
            position: "absolute",
            inset: 0,
            clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            background: C.primary + "22",
            zIndex: 5,
            animation: "none",
          }} />
        )}

        {/* Cost bar at bottom of hex */}
        {champ && (
          <div style={{
            position: "absolute",
            bottom: 4,
            left: "50%",
            transform: "translateX(-50%)",
            background: col + "ee",
            padding: "1px 6px",
            fontSize: 8,
            fontFamily: F.label,
            fontWeight: 700,
            color: "#000",
            zIndex: 6,
            letterSpacing: 0.5,
          }}>
            {champ.cost}G
          </div>
        )}
      </div>

      {/* Name + stars */}
      {champ && (
        <div style={{ marginTop: 4, textAlign: "center", width: HEX_W + 10 }}>
          <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {champ.name}
          </div>
          {starLabel && (
            <div style={{ fontSize: 8, color: col, lineHeight: 1, marginTop: 1 }}>{starLabel}</div>
          )}
        </div>
      )}

      {/* Item slots */}
      {champ && (
        <div style={{ display: "flex", gap: 2, marginTop: 3, justifyContent: "center" }}>
          {[0, 1, 2].map(function(si) {
            const itemKey = items[si] || null;
            return (
              <div
                key={si}
                title={itemKey ? (ITEM_MAP[itemKey] ? ITEM_MAP[itemKey].name : itemKey) : "Empty slot"}
                onClick={function(e) { e.stopPropagation(); if (itemKey) onRemoveItem(hid, si); }}
                style={{
                  width: 17,
                  height: 17,
                  border: "1px solid " + (itemKey ? (col + "99") : C.border),
                  background: itemKey ? C.surfaceHigh : C.surfaceLow,
                  overflow: "hidden",
                  cursor: itemKey ? "pointer" : "default",
                  flexShrink: 0,
                }}
              >
                {itemKey ? (
                  <ItemSlotImg itemKey={itemKey} size={17} />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: "transparent" }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TraitRow({ name, count, trait }) {
  const breakpoints = trait && trait.effects ? trait.effects.map(function(e) { return e.minUnits; }).filter(Boolean) : [];
  const activeBp    = breakpoints.filter(function(bp) { return bp <= count; });
  const nextBp      = breakpoints.find(function(bp) { return bp > count; });
  const active      = activeBp.length > 0;
  const col         = TRAIT_COLOR[(trait && trait.type) || "class"] || C.borderLight;
  const pct         = nextBp ? Math.round((count / nextBp) * 100) : 100;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      background: active ? col + "12" : "transparent",
      borderLeft: "3px solid " + (active ? col : C.border),
      marginBottom: 1,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: active && nextBp ? 4 : 0 }}>
          <span style={{ fontSize: 11, fontFamily: F.label, fontWeight: 700, color: active ? col : C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{name}</span>
          <span style={{ fontSize: 11, fontFamily: F.label, color: active ? col : C.textDim, fontWeight: 700 }}>{count}</span>
          <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
            {breakpoints.map(function(bp, i) {
              const reached = bp <= count;
              return (
                <span key={i} style={{ fontSize: 9, padding: "0 4px", background: reached ? col + "28" : "transparent", color: reached ? col : C.textSub, fontFamily: F.label, fontWeight: 700, border: "1px solid " + (reached ? col + "55" : C.border) }}>
                  {bp}
                </span>
              );
            })}
          </div>
        </div>
        {active && nextBp && (
          <div style={{ height: 2, background: C.border }}>
            <div style={{ height: "100%", width: pct + "%", background: col }} />
          </div>
        )}
        {nextBp && !active && (
          <div style={{ fontSize: 9, color: C.textSub, fontFamily: F.label }}>need {nextBp - count} more</div>
        )}
      </div>
    </div>
  );
}

function ItemPickerIcon({ item, onClick }) {
  const [err, setErr] = useState(false);
  return (
    <div
      onClick={onClick}
      title={item.name + (item.acronym ? " (" + item.acronym + ")" : "")}
      style={{
        width: 32,
        height: 32,
        border: "1px solid " + C.border,
        background: C.surfaceHigh,
        overflow: "hidden",
        cursor: "pointer",
        flexShrink: 0,
        transition: "border-color 0.1s, filter 0.1s",
      }}
      onMouseEnter={function(e) { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.filter = "brightness(1.25)"; }}
      onMouseLeave={function(e) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.filter = "none"; }}
    >
      {!err && item.icon ? (
        <img src={item.icon} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={function() { setErr(true); }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: C.surfaceLow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: C.textDim, fontFamily: F.label, fontWeight: 700 }}>
          {(item.acronym || item.name).slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

function TeamBuilder({ champions, traits }) {
  const [board,  setBoard]  = useState(makeBoard);
  const [slots,  setSlots]  = useState(makeSlots);
  const [stars,  setStars]  = useState(makeStars);
  const [selected, setSelected] = useState(null);  // hexId or null
  const [pendingChamp, setPendingChamp] = useState(null);  // champ waiting to be placed
  const [costFilter, setCostFilter]     = useState([1, 2, 3, 4, 5]);
  const [traitFilter, setTraitFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [itemTab, setItemTab] = useState("combined");
  const [history, setHistory] = useState([]);
  var [dragOverHid, setDragOverHid] = useState(null);

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

  const traitMap = useMemo(function() {
    const m = {};
    traits.forEach(function(t) { m[t.name] = t; });
    return m;
  }, [traits]);

  const champByKey = useMemo(function() {
    const m = {};
    champions.forEach(function(c) { m[c.key] = c; });
    return m;
  }, [champions]);

  // trait options for filter
  const traitOptions = useMemo(function() {
    const names = [];
    traits.filter(function(t) { return t.type === "origin" || t.type === "class"; })
      .sort(function(a, b) { return a.name.localeCompare(b.name); })
      .forEach(function(t) { names.push(t.name); });
    return names;
  }, [traits]);

  const boardChampCounts = useMemo(function() {
    const m = {};
    Object.values(board).forEach(function(c) {
      if (c) m[c.key] = (m[c.key] || 0) + 1;
    });
    return m;
  }, [board]);

  const poolChamps = useMemo(function() {
    const q = search.toLowerCase().trim();
    return champions.filter(function(c) {
      if (!costFilter.includes(c.cost)) return false;
      if (traitFilter !== "all" && !c.traits.includes(traitFilter)) return false;
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.traits.some(function(t) { return t.toLowerCase().includes(q); })) return true;
      return false;
    });
  }, [champions, costFilter, traitFilter, search]);

  const traitCounts = useMemo(function() {
    const counts = {};
    Object.values(board).forEach(function(champ) {
      if (!champ) return;
      champ.traits.forEach(function(t) {
        if (t !== "Choose Trait") counts[t] = (counts[t] || 0) + 1;
      });
    });
    return counts;
  }, [board]);

  const sortedTraits = useMemo(function() {
    return Object.entries(traitCounts).sort(function(a, b) {
      const ta = traitMap[a[0]];
      const tb = traitMap[b[0]];
      const bpsA = ta && ta.effects ? ta.effects.map(function(e) { return e.minUnits; }).filter(Boolean) : [];
      const bpsB = tb && tb.effects ? tb.effects.map(function(e) { return e.minUnits; }).filter(Boolean) : [];
      const actA = bpsA.filter(function(bp) { return bp <= a[1]; }).length;
      const actB = bpsB.filter(function(bp) { return bp <= b[1]; }).length;
      if (actB !== actA) return actB - actA;
      return b[1] - a[1];
    });
  }, [traitCounts, traitMap]);

  const boardCount = Object.values(board).filter(Boolean).length;
  const totalGold  = Object.values(board).filter(Boolean).reduce(function(sum, c) { return sum + c.cost; }, 0);
  const selectedChamp = selected ? board[selected] : null;

  function saveHistory() {
    setHistory(function(prev) {
      return [...prev.slice(-19), { board: { ...board }, slots: JSON.parse(JSON.stringify(slots)), stars: { ...stars } }];
    });
  }

  function handleClickHex(hid) {
    if (pendingChamp) {
      // Place pending champion
      if (!board[hid]) {
        saveHistory();
        setBoard(function(prev) { const next = { ...prev }; next[hid] = pendingChamp; return next; });
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
    // If a hex is selected and empty… can't happen (selected requires champ on it)
    // Just set pending
    setPendingChamp(champ);
    // find first empty hex and place there
    const keys = Object.keys(board);
    for (let i = 0; i < keys.length; i++) {
      if (!board[keys[i]]) {
        saveHistory();
        setBoard(function(prev) { const next = { ...prev }; next[keys[i]] = champ; return next; });
        setSelected(keys[i]);
        setPendingChamp(null);
        return;
      }
    }
    // Board full
    setPendingChamp(null);
  }

  function handleRemoveChamp(hid) {
    if (!board[hid]) return;
    saveHistory();
    setBoard(function(prev) { const next = { ...prev }; next[hid] = null; return next; });
    setSlots(function(prev) {
      const next = JSON.parse(JSON.stringify(prev));
      next[hid] = [null, null, null];
      return next;
    });
    if (selected === hid) setSelected(null);
  }

  function handleRemoveItem(hid, slotIdx) {
    setSlots(function(prev) {
      const next = JSON.parse(JSON.stringify(prev));
      next[hid][slotIdx] = null;
      return next;
    });
  }

  function handleAssignItem(itemKey) {
    if (!selected || !board[selected]) return;
    setSlots(function(prev) {
      const next = JSON.parse(JSON.stringify(prev));
      const sl = next[selected];
      const emptyIdx = sl.findIndex(function(x) { return x === null; });
      if (emptyIdx !== -1) sl[emptyIdx] = itemKey;
      return next;
    });
  }

  function cycleStars(hid) {
    if (!board[hid]) return;
    setStars(function(prev) {
      const next = { ...prev };
      next[hid] = next[hid] >= 3 ? 1 : next[hid] + 1;
      return next;
    });
  }

  function handleUndo() {
    if (!history.length) return;
    const last = history[history.length - 1];
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
    const comp = compLinesData.find(function(c) { return c.id === compId; });
    if (!comp) return;
    saveHistory();
    const next = makeBoard();
    const nextSlots = makeSlots();
    const allUnits = [...comp.core, ...(comp.flex || [])];
    const keys = Object.keys(next);
    let ci = 0;
    allUnits.forEach(function(key) {
      const champ = champByKey[key];
      if (!champ) return;
      while (ci < keys.length && next[keys[ci]] !== null) ci++;
      if (ci < keys.length) {
        next[keys[ci]] = champ;
        // pre-fill items from comp
        if (comp.items && comp.items[key]) {
          const itemKeys = comp.items[key];
          for (let si = 0; si < Math.min(3, itemKeys.length); si++) {
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

  const currentItemList = itemTab === "combined" ? COMBINED_ITEMS
    : itemTab === "components" ? COMPONENT_ITEMS
    : ARTIFACT_ITEMS;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: F.headline, fontSize: 24, fontWeight: 700, textTransform: "uppercase", letterSpacing: -0.5, color: C.text, borderLeft: "4px solid " + C.primary, paddingLeft: 12, margin: 0 }}>
            Team Builder
          </h2>
          <p style={{ fontFamily: F.body, fontSize: 12, color: C.textDim, marginTop: 5, paddingLeft: 16 }}>
            Click unit to place. Click placed unit to select. Right-click placed unit to remove. Assign items via the panel.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <select
            defaultValue=""
            onChange={function(e) { if (e.target.value) { handleLoadComp(e.target.value); e.target.value = ""; } }}
            style={{ padding: "6px 10px", background: C.surfaceHigh, border: "1px solid " + C.border, color: C.textMuted, fontFamily: F.label, fontSize: 10, outline: "none", cursor: "pointer" }}
          >
            <option value="">Load Comp...</option>
            {compLinesData.map(function(comp) {
              return <option key={comp.id} value={comp.id}>{comp.name} ({comp.strategy})</option>;
            })}
          </select>
          <button
            onClick={handleUndo}
            disabled={!history.length}
            style={{ padding: "6px 12px", background: "transparent", border: "1px solid " + C.border, color: history.length ? C.textMuted : C.border, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", cursor: history.length ? "pointer" : "default" }}
          >
            UNDO
          </button>
          <button
            onClick={handleClear}
            style={{ padding: "6px 12px", background: C.error + "15", border: "1px solid " + C.error + "55", color: C.error, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}
          >
            CLEAR
          </button>
        </div>
      </div>

      {/* ── Board stats bar ── */}
      {boardCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10, padding: "6px 12px", background: C.surfaceLow, flexWrap: "wrap" }}>
          <span style={{ fontFamily: F.label, fontSize: 11, fontWeight: 700, color: C.primary }}>{boardCount}<span style={{ color: C.textDim, fontWeight: 400 }}>/28 units</span></span>
          <span style={{ fontFamily: F.label, fontSize: 11, fontWeight: 700, color: C.tertiary }}>{totalGold}g <span style={{ color: C.textDim, fontWeight: 400 }}>total cost</span></span>
          {[1, 2, 3, 4, 5].map(function(cost) {
            const n = Object.values(board).filter(function(c) { return c && c.cost === cost; }).length;
            if (!n) return null;
            return (
              <span key={cost} style={{ fontFamily: F.label, fontSize: 10, color: COST_COLOR[cost] }}>
                x{n} <span style={{ fontSize: 9 }}>{cost}g</span>
              </span>
            );
          })}
          {selected && selectedChamp && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontFamily: F.label, color: C.primary, fontWeight: 700 }}>{selectedChamp.name}</span>
              <button
                onClick={function() { cycleStars(selected); }}
                style={{ fontSize: 10, background: "transparent", border: "1px solid " + C.tertiary + "55", color: C.tertiary, padding: "1px 8px", cursor: "pointer", fontFamily: F.label, fontWeight: 700 }}
              >
                {"★".repeat(stars[selected])} {stars[selected]}★
              </button>
              <button
                onClick={function() { handleRemoveChamp(selected); }}
                style={{ fontSize: 9, background: C.error + "12", border: "1px solid " + C.error + "44", color: C.error, padding: "1px 8px", cursor: "pointer", fontFamily: F.label, fontWeight: 700, letterSpacing: 1 }}
              >
                REMOVE
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* ── Left: Champion Pool ── */}
        <div style={{ width: 210, flexShrink: 0 }}>
          <div style={{ background: C.surfaceLow, padding: "10px 10px 8px" }}>
            <div style={{ fontSize: 10, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Champion Pool</div>

            <input
              value={search}
              onChange={function(e) { setSearch(e.target.value); }}
              placeholder="Search name or trait..."
              style={{ width: "100%", padding: "6px 8px", background: C.surfaceHigh, border: "1px solid " + C.border, color: C.text, fontSize: 11, fontFamily: F.label, outline: "none", marginBottom: 8, boxSizing: "border-box" }}
            />

            {/* Cost filter */}
            <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
              {[1, 2, 3, 4, 5].map(function(cost) {
                const active = costFilter.includes(cost);
                const col = COST_COLOR[cost];
                return (
                  <button
                    key={cost}
                    onClick={function() { setCostFilter(function(prev) { return active ? prev.filter(function(c) { return c !== cost; }) : [...prev, cost].sort(); }); }}
                    style={{ flex: 1, height: 26, border: "1px solid " + (active ? col : C.border), background: active ? col + "22" : "transparent", color: active ? col : C.textDim, fontSize: 10, fontFamily: F.label, fontWeight: 700, cursor: "pointer" }}
                  >
                    {cost}
                  </button>
                );
              })}
            </div>

            {/* Trait filter */}
            <select
              value={traitFilter}
              onChange={function(e) { setTraitFilter(e.target.value); }}
              style={{ width: "100%", padding: "5px 8px", background: C.surfaceHigh, border: "1px solid " + C.border, color: C.textMuted, fontSize: 10, fontFamily: F.label, outline: "none", marginBottom: 4, boxSizing: "border-box" }}
            >
              <option value="all">All Traits</option>
              {traitOptions.map(function(name) { return <option key={name} value={name}>{name}</option>; })}
            </select>
          </div>

          {/* Champion list grouped by cost */}
          <div
            onDragOver={function(e) { e.preventDefault(); }}
            onDrop={handlePoolAreaDrop}
            style={{ maxHeight: 500, overflowY: "auto", background: C.surfaceLow }}
          >
            {[1, 2, 3, 4, 5].filter(function(cost) { return costFilter.includes(cost); }).map(function(cost) {
              const group = poolChamps.filter(function(c) { return c.cost === cost; });
              if (!group.length) return null;
              const col = COST_COLOR[cost];
              return (
                <div key={cost} style={{ borderTop: "1px solid " + C.border + "55" }}>
                  <div style={{ padding: "4px 10px", fontSize: 9, fontFamily: F.label, color: col, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
                    {cost}G — {group.length}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "2px 8px 8px" }}>
                    {group.map(function(champ) {
                      return (
                        <PoolIcon
                          key={champ.key}
                          champ={champ}
                          placed={boardChampCounts[champ.key] || 0}
                          onClick={function() { handlePoolClick(champ); }}
                          onDragStart={handlePoolDragStart}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {poolChamps.length === 0 && (
              <div style={{ padding: "20px 12px", fontSize: 11, color: C.textSub, fontFamily: F.label, textAlign: "center" }}>No units match</div>
            )}
          </div>
        </div>

        {/* ── Center: Board ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: C.surfaceLow, padding: "8px 12px", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase" }}>
              Board — {boardCount}/{ROWS * COLS}
            </span>
            {pendingChamp && (
              <span style={{ fontSize: 10, fontFamily: F.label, color: C.primary, letterSpacing: 0.5 }}>
                Placing {pendingChamp.name} — click a hex
              </span>
            )}
          </div>

          <div style={{
            background: "radial-gradient(ellipse at 50% 60%, " + C.surfaceHigh + " 0%, " + C.surfaceLow + " 100%)",
            border: "1px solid " + C.border,
            padding: "16px 20px 12px",
            overflowX: "auto",
          }}>
            <div style={{ position: "relative", width: BOARD_W, height: BOARD_H, margin: "0 auto" }}>
              {/* Board grid background dots */}
              {Array.from({ length: ROWS }, function(_, r) {
                return Array.from({ length: COLS }, function(_, c) {
                  const isOdd = r % 2 === 1;
                  const bx = c * COL_STEP + (isOdd ? 0 : STAGGER) + HEX_W / 2;
                  const by = r * ROW_STEP + HEX_H / 2;
                  return (
                    <div key={r + "_" + c + "_dot"} style={{
                      position: "absolute",
                      left: bx - 1,
                      top: by - 1,
                      width: 2,
                      height: 2,
                      background: C.border + "66",
                      borderRadius: "50%",
                      pointerEvents: "none",
                    }} />
                  );
                });
              })}

              {/* Hexes */}
              {Array.from({ length: ROWS }, function(_, r) {
                return Array.from({ length: COLS }, function(_, c) {
                  const hid   = hexId(r, c);
                  const champ = board[hid];
                  return (
                    <BoardHex
                      key={hid}
                      hid={hid}
                      r={r}
                      c={c}
                      champ={champ}
                      items={slots[hid]}
                      stars={stars[hid]}
                      selected={selected === hid}
                      pending={!!pendingChamp && !champ}
                      dragOver={dragOverHid === hid}
                      onClickHex={handleClickHex}
                      onRemoveItem={handleRemoveItem}
                      onDragStart={handleBoardDragStart}
                      onDragOver={handleHexDragOver}
                      onDrop={handleHexDrop}
                      onDragEnd={handleDragEnd}
                    />
                  );
                });
              })}
            </div>
          </div>

          {/* Placed unit badges */}
          {boardCount > 0 && (
            <div style={{ background: C.surfaceLow, padding: "6px 10px", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {Object.entries(board)
                .filter(function(e) { return e[1]; })
                .map(function(e) {
                  const hid   = e[0];
                  const champ = e[1];
                  const col   = COST_COLOR[champ.cost];
                  const isSelected = selected === hid;
                  return (
                    <span
                      key={hid}
                      onClick={function() { setSelected(isSelected ? null : hid); }}
                      style={{ fontSize: 9, fontFamily: F.label, color: isSelected ? "#000" : col, background: isSelected ? col : col + "18", padding: "2px 7px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, cursor: "pointer", border: "1px solid " + (isSelected ? col : col + "44") }}
                    >
                      {champ.name}
                    </span>
                  );
                })}
            </div>
          )}
        </div>

        {/* ── Right: Traits + Items ── */}
        <div style={{ width: 210, flexShrink: 0 }}>
          {/* Synergies */}
          <div style={{ background: C.surfaceLow, padding: "10px 10px 8px", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase" }}>Synergies</span>
              {sortedTraits.length > 0 && (
                <span style={{ fontSize: 10, fontFamily: F.label, color: C.primary, fontWeight: 700 }}>{sortedTraits.filter(function(e) {
                  const t = traitMap[e[0]];
                  const bps = t && t.effects ? t.effects.map(function(ef) { return ef.minUnits; }).filter(Boolean) : [];
                  return bps.some(function(bp) { return bp <= e[1]; });
                }).length} active</span>
              )}
            </div>
            {sortedTraits.length === 0 && (
              <div style={{ fontSize: 11, color: C.textSub, fontFamily: F.body, fontStyle: "italic", padding: "4px 0" }}>Place units to see synergies</div>
            )}
            {sortedTraits.map(function(entry) {
              return <TraitRow key={entry[0]} name={entry[0]} count={entry[1]} trait={traitMap[entry[0]]} />;
            })}
          </div>

          {/* Items Panel */}
          <div style={{ background: C.surfaceLow, padding: "10px 10px 8px" }}>
            {selected && selectedChamp ? (
              <div style={{ fontSize: 10, fontFamily: F.label, color: C.primary, letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>
                ITEMS: {selectedChamp.name.toUpperCase()}
              </div>
            ) : (
              <div style={{ fontSize: 10, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Items</div>
            )}

            {/* Tab row */}
            <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
              {[["combined","BIS"],["components","Comp"],["artifact","Art"]].map(function(pair) {
                const id = pair[0];
                const label = pair[1];
                const active = itemTab === id;
                return (
                  <button
                    key={id}
                    onClick={function() { setItemTab(id); }}
                    style={{ flex: 1, padding: "4px 0", fontSize: 9, fontFamily: F.label, fontWeight: 700, background: active ? C.secondary + "22" : "transparent", border: "1px solid " + (active ? C.secondary : C.border), color: active ? C.secondary : C.textDim, cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase" }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Item grid */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {currentItemList.map(function(item) {
                return (
                  <ItemPickerIcon
                    key={item.key}
                    item={item}
                    onClick={function() { handleAssignItem(item.key); }}
                  />
                );
              })}
            </div>

            {selected && selectedChamp && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid " + C.border + "44" }}>
                <div style={{ fontSize: 9, fontFamily: F.label, color: C.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Equipped</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2].map(function(si) {
                    const itemKey = slots[selected][si];
                    const item = itemKey ? ITEM_MAP[itemKey] : null;
                    return (
                      <div
                        key={si}
                        onClick={function() { if (itemKey) handleRemoveItem(selected, si); }}
                        title={item ? item.name + " (click to remove)" : "Empty"}
                        style={{
                          width: 32, height: 32,
                          border: "1px solid " + (itemKey ? C.primary + "66" : C.border),
                          background: C.surfaceHigh,
                          overflow: "hidden",
                          cursor: itemKey ? "pointer" : "default",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {itemKey ? (
                          <ItemSlotImg itemKey={itemKey} size={32} />
                        ) : (
                          <span style={{ fontSize: 14, color: C.border }}>+</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeamBuilder;
