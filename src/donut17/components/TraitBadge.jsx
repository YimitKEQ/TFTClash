import React from "react";
import { TRAIT_COLOR, C, F } from "../d17.js";

function TraitBadge({ trait, count = 0, showCount = false, compact = false }) {
  const color = TRAIT_COLOR[trait.type] || C.borderLight;
  return (
    <span
      title={trait.desc || trait.name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 3 : 5,
        padding: compact ? "1px 6px 1px 0" : "2px 8px 2px 0",
        background: C.surfaceHighest,
        fontSize: compact ? 9 : 10,
        fontFamily: F.label,
        fontWeight: 600,
        color: C.textMuted,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        borderLeft: "3px solid " + color,
        paddingLeft: compact ? 5 : 7,
      }}
    >
      {trait.name}
      {showCount && count > 0 && (
        <span style={{ background: color + "33", color: color, fontSize: compact ? 8 : 9, padding: "0 4px", fontWeight: 700 }}>
          {count}
        </span>
      )}
    </span>
  );
}

export default TraitBadge;
