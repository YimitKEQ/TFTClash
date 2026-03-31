import React, { useState } from "react";

const COST_COLORS = {
  1: "#9ca3af",
  2: "#22c55e",
  3: "#3b82f6",
  4: "#a855f7",
  5: "#eab308",
};

function ChampIcon({ champ, size = 40, showName = false, selected = false, onClick = null }) {
  const [imgError, setImgError] = useState(false);
  const color = COST_COLORS[champ.cost] || "#9ca3af";
  const src = champ.assets && champ.assets.face_lg ? champ.assets.face_lg : (champ.assets && champ.assets.face ? champ.assets.face : "");

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: 6,
    border: "2px solid " + color,
    overflow: "hidden",
    cursor: onClick ? "pointer" : "default",
    flexShrink: 0,
    position: "relative",
    boxShadow: selected ? ("0 0 0 2px #fff, 0 0 0 4px " + color) : "none",
    transition: "box-shadow 0.15s",
    background: "#0f1629",
  };

  const imgStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: imgError ? 0 : 1,
  };

  const fallbackStyle = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: Math.max(10, size * 0.3),
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 700,
    color: color,
    background: "rgba(255,255,255,0.04)",
    position: "absolute",
    top: 0,
    left: 0,
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={containerStyle} onClick={onClick} title={champ.name}>
        {src && (
          <img
            src={src}
            alt={champ.name}
            style={imgStyle}
            onError={() => setImgError(true)}
          />
        )}
        {(!src || imgError) && (
          <div style={fallbackStyle}>
            {champ.name ? champ.name.slice(0, 2).toUpperCase() : "?"}
          </div>
        )}
      </div>
      {showName && (
        <span style={{ fontSize: 9, color: "#94a3b8", fontFamily: "'Chakra Petch', sans-serif", textAlign: "center", lineHeight: 1, maxWidth: size + 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {champ.name}
        </span>
      )}
    </div>
  );
}

export default ChampIcon;
