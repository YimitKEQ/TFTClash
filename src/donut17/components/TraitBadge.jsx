import React, { useState } from "react";

const TYPE_COLORS = {
  origin: "#a78bfa",
  class: "#60a5fa",
  unique: "#f59e0b",
};

function TraitBadge({ trait, count = 0, showCount = false, size = "sm" }) {
  const [imgError, setImgError] = useState(false);
  const color = TYPE_COLORS[trait.type] || "#94a3b8";
  const isLarge = size === "lg";
  const iconSize = isLarge ? 18 : 14;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isLarge ? 5 : 3,
        padding: isLarge ? "3px 8px" : "2px 5px",
        borderRadius: 4,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid " + color + "44",
        fontSize: isLarge ? 12 : 10,
        fontFamily: "'Chakra Petch', sans-serif",
        color: color,
        whiteSpace: "nowrap",
      }}
      title={trait.desc || trait.name}
    >
      {trait.icon && !imgError && (
        <img
          src={trait.icon}
          alt=""
          style={{ width: iconSize, height: iconSize, opacity: 0.9, filter: "brightness(1.2)" }}
          onError={() => setImgError(true)}
        />
      )}
      {trait.name}
      {showCount && count > 0 && (
        <span style={{ fontWeight: 700, color: "#fff", background: color + "44", borderRadius: 3, padding: "0 3px", fontSize: isLarge ? 11 : 9 }}>
          {count}
        </span>
      )}
    </span>
  );
}

export default TraitBadge;
