import React from "react";

const COST_COLORS = {
  1: "#9ca3af",
  2: "#22c55e",
  3: "#3b82f6",
  4: "#a855f7",
  5: "#eab308",
};

const COST_LABELS = {
  1: "1g",
  2: "2g",
  3: "3g",
  4: "4g",
  5: "5g",
};

function CostBadge({ cost, showLabel = true }) {
  const color = COST_COLORS[cost] || "#9ca3af";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1px 6px",
        borderRadius: 4,
        background: color + "22",
        border: "1px solid " + color + "66",
        color: color,
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        lineHeight: 1.4,
      }}
    >
      {showLabel ? COST_LABELS[cost] || cost : cost}
    </span>
  );
}

export default CostBadge;
