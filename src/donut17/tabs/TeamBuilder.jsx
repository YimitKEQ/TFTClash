import React, { useState, useMemo } from "react";
import { C, F, COST_COLOR, TRAIT_COLOR } from "../d17.js";
import ChampIcon from "../components/ChampIcon.jsx";
import ItemIcon from "../components/ItemIcon.jsx";
import compLinesData from "../data/comp_lines.json";

// TFT board: 4 rows x 7 cols, even rows offset by half cell
const ROWS = 4;
const COLS = 7;
const TOTAL = ROWS * COLS;

function emptyBoard() {
  const b = {};
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      b[r + "_" + c] = null;
    }
  }
  return b;
}

function calcTraits(board, champions) {
  const counts = {};
  Object.values(board).forEach(function(champ) {
    if (!champ) return;
    champ.traits.forEach(function(t) {
      if (t !== "Choose Trait") counts[t] = (counts[t] || 0) + 1;
    });
  });
  return counts;
}

function BoardHex({ champ, row, col, selected, onSelect, onRemove }) {
  const [err, setErr] = useState(false);
  const offset = row % 2 === 0;
  const CELL = 62;
  const GAP = 4;
  const x = col * (CELL + GAP) + (offset ? (CELL + GAP) / 2 : 0);
  const y = row * (CELL * 0.78 + GAP);
  const col_ = champ ? COST_COLOR[champ.cost] || "#958da2" : C.border;

  return (
    <div
      onClick={function() { champ ? onSelect() : null; }}
      onContextMenu={function(e) { e.preventDefault(); if (champ) onRemove(); }}
      title={champ ? champ.name + " (right-click to remove)" : "Empty"}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: CELL,
        height: CELL,
        background: champ ? C.surface : C.surfaceLow,
        border: selected ? "2px solid " + C.primary : "1px solid " + (champ ? col_ + "88" : C.border),
        cursor: champ ? "pointer" : "default",
        overflow: "hidden",
        transition: "all 0.1s",
        clipPath: "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
      }}
    >
      {champ ? (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          {champ.assets && champ.assets.face_lg ? (
            !err ? (
              <img
                src={champ.assets.face_lg}
                alt={champ.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
                onError={function() { setErr(true); }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", background: col_ + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: col_, fontFamily: F.label, fontWeight: 700 }}>
                {champ.name.slice(0, 2).toUpperCase()}
              </div>
            )
          ) : (
            <div style={{ width: "100%", height: "100%", background: col_ + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: col_, fontFamily: F.label, fontWeight: 700 }}>
              {champ.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          {/* Cost indicator */}
          <div style={{ position: "absolute", bottom: 5, left: "50%", transform: "translateX(-50%)", background: col_ + "dd", padding: "1px 5px", fontSize: 7, fontFamily: F.label, fontWeight: 700, color: "#000" }}>
            {champ.cost}G
          </div>
        </div>
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 16, color: C.border }}>+</span>
        </div>
      )}
    </div>
  );
}

function TraitRow({ name, count, trait }) {
  const breakpoints = trait && trait.effects ? trait.effects.map(function(e) { return e.minUnits; }).filter(Boolean) : [];
  const nextBp = breakpoints.find(function(bp) { return bp > count; });
  const active = breakpoints.some(function(bp) { return bp <= count; });
  const col = TRAIT_COLOR[(trait && trait.type) || "class"] || C.borderLight;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 8px",
      background: active ? col + "0d" : "transparent",
      borderLeft: "3px solid " + (active ? col : C.border),
      marginBottom: 2,
    }}>
      <span style={{ flex: 1, fontSize: 10, fontFamily: F.label, fontWeight: 700, color: active ? col : C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{name}</span>
      <span style={{ fontSize: 10, fontFamily: F.label, color: active ? col : C.textDim, fontWeight: 700 }}>{count}</span>
      <div style={{ display: "flex", gap: 2 }}>
        {breakpoints.map(function(bp, i) {
          return (
            <span key={i} style={{ fontSize: 8, padding: "0 3px", background: bp <= count ? col + "22" : "transparent", color: bp <= count ? col : C.border, fontFamily: F.label, fontWeight: 700, border: "1px solid " + (bp <= count ? col + "44" : "transparent") }}>
              {bp}
            </span>
          );
        })}
      </div>
      {nextBp && (
        <span style={{ fontSize: 8, color: C.textDim, fontFamily: F.label, whiteSpace: "nowrap" }}>need {nextBp - count}</span>
      )}
    </div>
  );
}

function TeamBuilder({ champions, traits }) {
  const [board, setBoard] = useState(emptyBoard);
  const [selectedHex, setSelectedHex] = useState(null);
  const [costFilter, setCostFilter] = useState([1, 2, 3]);
  const [search, setSearch] = useState("");
  const [loadComp, setLoadComp] = useState(null);

  const traitMap = useMemo(function() {
    const m = {};
    traits.forEach(function(t) { m[t.name] = t; });
    return m;
  }, [traits]);

  const champsByKey = useMemo(function() {
    const m = {};
    champions.forEach(function(c) { m[c.key] = c; });
    return m;
  }, [champions]);

  const poolChamps = useMemo(function() {
    const q = search.toLowerCase().trim();
    return champions.filter(function(c) {
      if (!costFilter.includes(c.cost)) return false;
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.traits.some(function(t) { return t.toLowerCase().includes(q); })) return true;
      return false;
    });
  }, [champions, costFilter, search]);

  const traitCounts = useMemo(function() {
    return calcTraits(board, champions);
  }, [board, champions]);

  const boardChamps = useMemo(function() {
    const placed = {};
    Object.values(board).forEach(function(c) {
      if (c) placed[c.key] = (placed[c.key] || 0) + 1;
    });
    return placed;
  }, [board]);

  const boardCount = Object.values(board).filter(Boolean).length;

  function placeChamp(champ) {
    setBoard(function(prev) {
      const next = { ...prev };
      // If a hex is selected, place there
      if (selectedHex && next[selectedHex] === null) {
        next[selectedHex] = champ;
        setSelectedHex(null);
        return next;
      }
      // Otherwise, find first empty hex
      const cells = Object.keys(next);
      for (let i = 0; i < cells.length; i++) {
        if (next[cells[i]] === null) {
          next[cells[i]] = champ;
          return next;
        }
      }
      return next;
    });
  }

  function removeChamp(hexKey) {
    setBoard(function(prev) {
      const next = { ...prev };
      next[hexKey] = null;
      return next;
    });
    if (selectedHex === hexKey) setSelectedHex(null);
  }

  function clearBoard() {
    setBoard(emptyBoard());
    setSelectedHex(null);
  }

  function handleLoadComp(compId) {
    const comp = compLinesData.find(function(c) { return c.id === compId; });
    if (!comp) return;
    const next = emptyBoard();
    const allUnits = [...comp.core, ...(comp.flex || [])];
    const cells = Object.keys(next);
    let ci = 0;
    allUnits.forEach(function(key) {
      const champ = champsByKey[key];
      if (!champ) return;
      while (ci < cells.length && next[cells[ci]] !== null) ci++;
      if (ci < cells.length) {
        next[cells[ci]] = champ;
        ci++;
      }
    });
    setBoard(next);
    setSelectedHex(null);
    setLoadComp(null);
  }

  const CELL = 62;
  const GAP = 4;
  const boardW = COLS * (CELL + GAP) + (CELL + GAP) / 2;
  const boardH = ROWS * (CELL * 0.78 + GAP) + CELL * 0.22;

  const sortedTraits = Object.entries(traitCounts)
    .sort(function(a, b) { return b[1] - a[1]; });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: F.headline, fontSize: 24, fontWeight: 700, textTransform: "uppercase", letterSpacing: -0.5, color: C.text, borderLeft: "4px solid " + C.primary, paddingLeft: 12, margin: 0 }}>
            Team Builder
          </h2>
          <p style={{ fontFamily: F.body, fontSize: 12, color: C.textDim, marginTop: 6, paddingLeft: 16 }}>
            Click units from the pool to place them. Right-click to remove. Load a comp or build from scratch.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={loadComp || ""}
            onChange={function(e) { if (e.target.value) handleLoadComp(e.target.value); }}
            style={{ padding: "6px 10px", background: C.surfaceLow, border: "1px solid " + C.border, color: C.text, fontFamily: F.label, fontSize: 9, letterSpacing: 1, outline: "none", cursor: "pointer", textTransform: "uppercase" }}
          >
            <option value="">LOAD COMP...</option>
            {compLinesData.map(function(comp) {
              return <option key={comp.id} value={comp.id}>{comp.name}</option>;
            })}
          </select>
          <button
            onClick={clearBoard}
            style={{ padding: "6px 12px", background: C.error + "11", border: "1px solid " + C.error + "44", color: C.error, fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}
          >
            CLEAR
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* ── Left: pool ── */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ background: C.surfaceLow, padding: 10, marginBottom: 2 }}>
            <div style={{ fontSize: 9, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Champion Pool</div>
            <input
              value={search}
              onChange={function(e) { setSearch(e.target.value); }}
              placeholder="Search..."
              style={{ width: "100%", padding: "5px 8px", background: C.surfaceHigh, border: "1px solid " + C.border, color: C.text, fontSize: 10, fontFamily: F.label, outline: "none", marginBottom: 8, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 4 }}>
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
                    style={{ flex: 1, height: 24, border: "1px solid " + (active ? col : C.border), background: active ? col + "22" : "transparent", color: active ? col : C.textDim, fontSize: 9, fontFamily: F.label, fontWeight: 700, cursor: "pointer" }}
                  >
                    {cost}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {[1, 2, 3, 4, 5].filter(function(c) { return costFilter.includes(c); }).map(function(cost) {
              const group = poolChamps.filter(function(c) { return c.cost === cost; });
              if (!group.length) return null;
              const col = COST_COLOR[cost];
              return (
                <div key={cost} style={{ background: C.surfaceLow, borderBottom: "1px solid " + C.border + "44" }}>
                  <div style={{ padding: "4px 10px", fontSize: 8, fontFamily: F.label, color: col, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
                    {cost}G — {group.length}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "4px 8px 8px" }}>
                    {group.map(function(champ) {
                      const placed = boardChamps[champ.key] || 0;
                      return (
                        <div
                          key={champ.key}
                          onClick={function() { placeChamp(champ); }}
                          title={champ.name}
                          style={{ position: "relative", cursor: "pointer", opacity: placed ? 0.45 : 1 }}
                        >
                          <ChampIcon champ={champ} size={34} />
                          {placed > 0 && (
                            <div style={{ position: "absolute", top: -2, right: -2, width: 12, height: 12, background: COST_COLOR[champ.cost], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontFamily: F.label, fontWeight: 900, color: "#000" }}>
                              {placed}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Center: board ── */}
        <div style={{ flex: 1 }}>
          <div style={{ background: C.surfaceLow, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase" }}>
              Board — {boardCount}/{TOTAL} units
            </span>
            {selectedHex && (
              <span style={{ fontSize: 9, fontFamily: F.label, color: C.primary, letterSpacing: 1 }}>
                Hex selected — click a unit to place
              </span>
            )}
          </div>

          <div style={{ background: C.surface, padding: 16, position: "relative" }}>
            <div style={{ position: "relative", width: boardW, height: boardH, margin: "0 auto" }}>
              {Array.from({ length: ROWS }, function(_, r) {
                return Array.from({ length: COLS }, function(_, c) {
                  const key = r + "_" + c;
                  return (
                    <BoardHex
                      key={key}
                      row={r}
                      col={c}
                      champ={board[key]}
                      selected={selectedHex === key}
                      onSelect={function() { setSelectedHex(selectedHex === key ? null : key); }}
                      onRemove={function() { removeChamp(key); }}
                    />
                  );
                });
              })}
            </div>
          </div>

          {/* Name labels under board */}
          {boardCount > 0 && (
            <div style={{ background: C.surfaceLow, padding: "8px 12px", marginTop: 2, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(board)
                .filter(function(entry) { return entry[1] !== null; })
                .map(function(entry) {
                  const champ = entry[1];
                  const col = COST_COLOR[champ.cost];
                  return (
                    <span key={entry[0]} style={{ fontSize: 8, fontFamily: F.label, color: col, background: col + "15", padding: "1px 6px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
                      {champ.name}
                    </span>
                  );
                })}
            </div>
          )}
        </div>

        {/* ── Right: traits ── */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ background: C.surfaceLow, padding: 10, marginBottom: 2 }}>
            <div style={{ fontSize: 9, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
              Active Synergies
              {sortedTraits.length > 0 && (
                <span style={{ marginLeft: 6, color: C.primary }}>{sortedTraits.length}</span>
              )}
            </div>

            {sortedTraits.length === 0 && (
              <div style={{ fontSize: 10, color: C.border, fontFamily: F.body, fontStyle: "italic" }}>Place units to see synergies</div>
            )}

            {sortedTraits.map(function(entry) {
              const name = entry[0];
              const count = entry[1];
              const trait = traitMap[name];
              return (
                <TraitRow key={name} name={name} count={count} trait={trait} />
              );
            })}
          </div>

          {boardCount > 0 && (
            <div style={{ background: C.surfaceLow, padding: 10, marginTop: 2 }}>
              <div style={{ fontSize: 9, fontFamily: F.label, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                Unit Count by Cost
              </div>
              {[1, 2, 3, 4, 5].map(function(cost) {
                const units = Object.values(board).filter(function(c) { return c && c.cost === cost; });
                if (!units.length) return null;
                const col = COST_COLOR[cost];
                return (
                  <div key={cost} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 8, fontFamily: F.label, color: col, fontWeight: 700, width: 12, textAlign: "right" }}>{cost}G</span>
                    <div style={{ flex: 1, height: 3, background: C.border }}>
                      <div style={{ height: "100%", width: (units.length / boardCount * 100) + "%", background: col }} />
                    </div>
                    <span style={{ fontSize: 8, fontFamily: F.label, color: C.textDim, width: 12 }}>x{units.length}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamBuilder;
