import React, { useState } from "react";
import { COST_COLOR, C } from "../d17.js";

function ChampIcon({ champ, size = 40, showName = false, selected = false, onClick = null, overlay = null }) {
  const [err, setErr] = useState(false);
  const color = COST_COLOR[champ.cost] || C.borderLight;
  const src = champ.assets ? (size >= 48 ? champ.assets.face_lg : champ.assets.face) : "";

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
      <div
        onClick={onClick}
        title={champ.name}
        style={{
          width: size,
          height: size,
          border: selected ? ("2px solid " + color) : ("1px solid " + color + "88"),
          outline: selected ? ("2px solid " + color + "55") : "none",
          outlineOffset: 2,
          background: C.surfaceHigh,
          overflow: "hidden",
          cursor: onClick ? "pointer" : "default",
          position: "relative",
          flexShrink: 0,
          transition: "border-color 0.1s, outline 0.1s",
        }}
      >
        {src && !err && (
          <img
            src={src}
            alt={champ.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={function() { setErr(true); }}
          />
        )}
        {(!src || err) && (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(9, size * 0.28), fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: color, letterSpacing: -0.5 }}>
            {champ.name ? champ.name.slice(0, 2).toUpperCase() : "?"}
          </div>
        )}
        {overlay && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.75)", fontSize: 8, color: color, fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "1px 0", fontWeight: 700 }}>
            {overlay}
          </div>
        )}
        <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: color }} />
      </div>
      {showName && (
        <span style={{ fontSize: 8, color: C.textDim, fontFamily: "'Inter', sans-serif", textAlign: "center", lineHeight: 1, maxWidth: size + 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.3 }}>
          {champ.name}
        </span>
      )}
    </div>
  );
}

export default ChampIcon;
