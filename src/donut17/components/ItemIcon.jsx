import React, { useState } from "react";
import { C, F, ITEM_TYPE_COLOR } from "../d17.js";
import itemsData from "../data/items_clean.json";
import Tooltip from "./Tooltip.jsx";

var ITEM_MAP = {};
itemsData.forEach(function(item) { ITEM_MAP[item.key] = item; });

function getItemColor(item) {
  if (!item || !item.tags) return C.borderLight;
  var tags = item.tags;
  if (tags.includes("ad")) return ITEM_TYPE_COLOR.ad;
  if (tags.includes("ap")) return ITEM_TYPE_COLOR.ap;
  if (tags.includes("tank")) return ITEM_TYPE_COLOR.tank;
  if (tags.includes("utility")) return ITEM_TYPE_COLOR.utility;
  if (tags.includes("artifact")) return ITEM_TYPE_COLOR.artifact;
  if (tags.includes("emblem")) return ITEM_TYPE_COLOR.emblem;
  return C.borderLight;
}

function ItemIcon(props) {
  var item = ITEM_MAP[props.itemKey] || { name: props.itemKey || "?", icon: "", key: props.itemKey, tags: [] };
  var sz = props.size || 28;
  var state = useState(false);
  var err = state[0];
  var setErr = state[1];
  var color = getItemColor(item);
  var tipText = item.name || "";

  return React.createElement(Tooltip, { text: tipText },
    React.createElement("div", {
      style: Object.assign({
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        flexShrink: 0,
      }, props.style || {})
    },
      React.createElement("div", {
        style: {
          width: sz, height: sz,
          borderRadius: Math.round(sz * 0.2),
          border: "1px solid " + color + "55",
          background: color + "10",
          overflow: "hidden",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }
      },
        !err && item.icon
          ? React.createElement("img", {
              src: item.icon,
              alt: item.name,
              style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
              onError: function() { setErr(true); },
            })
          : React.createElement("div", {
              style: {
                fontSize: Math.max(9, sz * 0.3),
                color: color,
                fontFamily: F.body,
                fontWeight: 700,
              }
            }, (item.acronym || item.name || "").slice(0, 2).toUpperCase())
      ),
      props.showName && React.createElement("span", {
        style: {
          fontSize: 9,
          fontFamily: F.label,
          color: C.textSecondary,
          textAlign: "center",
          maxWidth: sz + 8,
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }
      }, item.acronym || item.name)
    )
  );
}

export { ITEM_MAP };
export default ItemIcon;
