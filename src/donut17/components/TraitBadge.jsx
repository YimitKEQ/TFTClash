import React from "react";
import { TRAIT_COLOR, C, F } from "../d17.js";

function TraitBadge(props) {
  var trait = props.trait;
  var color = TRAIT_COLOR[trait.type] || C.borderLight;
  var ct = props.count || 0;

  return React.createElement("span", {
    title: trait.desc ? trait.desc.replace(/<[^>]*>/g, "").slice(0, 120) : trait.name,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: props.compact ? 4 : 5,
      padding: props.compact ? "2px 8px" : "4px 12px",
      borderRadius: 6,
      background: color + "10",
      border: "1px solid " + color + "30",
      fontSize: props.compact ? 10 : 11,
      fontFamily: F.body,
      fontWeight: 500,
      color: color,
      whiteSpace: "nowrap",
    }
  },
    React.createElement("span", {
      style: {
        width: props.compact ? 4 : 5,
        height: props.compact ? 4 : 5,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }
    }),
    trait.name,
    props.showCount && ct > 0 && React.createElement("strong", {
      style: { fontWeight: 700 }
    }, ct)
  );
}

export default TraitBadge;
