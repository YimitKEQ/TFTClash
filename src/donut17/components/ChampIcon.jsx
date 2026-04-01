import React, { useState } from "react";
import { COST_COLOR, COST_BORDER, COST_BG_TOP, COST_BG_BOT, C, F } from "../d17.js";
import Tooltip from "./Tooltip.jsx";

function ChampIcon(props) {
  var champ = props.champ;
  var sz = props.size || 44;
  var state = useState(false);
  var err = state[0];
  var setErr = state[1];
  var color = COST_COLOR[champ.cost] || C.borderLight;
  var border = COST_BORDER[champ.cost] || C.borderLight;
  var bgTop = COST_BG_TOP[champ.cost] || C.surfaceHigh;
  var bgBot = COST_BG_BOT[champ.cost] || C.surfaceHigh;
  var radius = Math.round(sz * 0.22);
  var src = champ.assets ? (sz >= 48 ? champ.assets.face_lg : champ.assets.face) : "";
  var tooltipText = champ.name + (champ.cost ? " (" + champ.cost + "g)" : "");

  return React.createElement(Tooltip, { text: tooltipText },
    React.createElement("div", {
      style: { display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }
    },
      React.createElement("div", {
        onClick: props.onClick || null,
        style: {
          width: sz,
          height: sz,
          borderRadius: radius,
          border: "2px solid " + (props.selected ? color : border),
          background: "linear-gradient(180deg, " + bgTop + " 0%, " + bgBot + " 100%)",
          overflow: "hidden",
          cursor: props.onClick ? "pointer" : "default",
          position: "relative",
          flexShrink: 0,
          transition: "transform 0.15s, border-color 0.15s",
          outline: props.selected ? ("2px solid " + color + "55") : "none",
          outlineOffset: 2,
        },
        onMouseEnter: function(e) { if (props.onClick) e.currentTarget.style.transform = "scale(1.12)"; },
        onMouseLeave: function(e) { e.currentTarget.style.transform = "scale(1)"; },
      },
        src && !err
          ? React.createElement("img", {
              src: src,
              alt: champ.name,
              style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
              onError: function() { setErr(true); },
            })
          : React.createElement("div", {
              style: {
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: Math.max(10, sz * 0.24),
                fontFamily: F.body,
                fontWeight: 700,
                color: color,
              }
            }, champ.name ? champ.name.slice(0, 3) : "?"),
        props.showCarry && React.createElement("div", {
          style: {
            position: "absolute", top: -5, right: -5,
            background: "linear-gradient(135deg, #c8b8ff, #9b8adf)",
            color: C.bg,
            fontSize: 7, fontWeight: 800,
            padding: "2px 5px",
            borderRadius: 4,
            letterSpacing: 0.5,
            lineHeight: 1,
            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
          }
        }, "CARRY"),
        props.showCost && React.createElement("div", {
          style: {
            position: "absolute", bottom: -3, right: -3,
            fontSize: 9, fontWeight: 800,
            padding: "1px 5px",
            borderRadius: 4,
            color: C.bg,
            background: color,
          }
        }, champ.cost),
        props.overlay && React.createElement("div", {
          style: {
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "rgba(0,0,0,0.75)",
            fontSize: 10, color: color,
            fontFamily: F.body,
            textAlign: "center",
            padding: "1px 0",
            fontWeight: 700,
            borderRadius: "0 0 " + radius + "px " + radius + "px",
          }
        }, props.overlay)
      ),
      props.showName && React.createElement("span", {
        style: {
          fontSize: 10, color: C.textSecondary,
          fontFamily: F.body,
          textAlign: "center",
          lineHeight: 1,
          maxWidth: sz + 8,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }
      }, champ.name)
    )
  );
}

export default ChampIcon;
