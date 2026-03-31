import React, { useState } from "react";
import { C, F } from "../d17.js";
import itemsData from "../data/items_clean.json";

const ITEM_MAP = {};
itemsData.forEach(function(item) { ITEM_MAP[item.key] = item; });

function ItemIcon({ itemKey, size, showName, style: extra }) {
  const item = ITEM_MAP[itemKey] || { name: itemKey, icon: "", key: itemKey };
  const sz = size || 28;
  const [err, setErr] = useState(false);

  const tagColor = item.tags && item.tags.includes("ad") ? "#e9c400"
    : item.tags && item.tags.includes("ap") ? "#cdbdff"
    : item.tags && item.tags.includes("tank") ? "#8dcdff"
    : item.tags && item.tags.includes("utility") ? "#4ade80"
    : item.tags && item.tags.includes("artifact") ? "#f59e0b"
    : item.tags && item.tags.includes("emblem") ? "#ec4899"
    : "#494456";

  return (
    <div
      title={item.name + (item.acronym ? " (" + item.acronym + ")" : "")}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        flexShrink: 0,
        ...extra,
      }}
    >
      <div style={{
        width: sz,
        height: sz,
        border: "1px solid " + tagColor + "55",
        background: C.surfaceHigh,
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
      }}>
        {!err && item.icon ? (
          <img
            src={item.icon}
            alt={item.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={function() { setErr(true); }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: tagColor + "22",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: Math.max(8, sz * 0.3),
            color: tagColor,
            fontFamily: F.label,
            fontWeight: 700,
          }}>
            {(item.acronym || item.name).slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      {showName && (
        <span style={{
          fontSize: 9,
          fontFamily: F.label,
          color: C.textDim,
          textAlign: "center",
          maxWidth: sz + 8,
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {item.acronym || item.name}
        </span>
      )}
    </div>
  );
}

export { ITEM_MAP };
export default ItemIcon;
