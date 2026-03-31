import React, { useState } from "react";

function GodCard({ god, compact = false }) {
  const [imgError, setImgError] = useState(false);
  const [open, setOpen] = useState(false);

  if (compact) {
    return (
      <div
        style={{ border: "1px solid " + god.color + "44", borderRadius: 8, padding: "10px 12px", background: "rgba(15,22,41,0.6)", cursor: "pointer", transition: "border-color 0.15s" }}
        onClick={() => setOpen(!open)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!imgError && god.image && (
            <img
              src={god.image}
              alt={god.name}
              style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", border: "1px solid " + god.color + "66" }}
              onError={() => setImgError(true)}
            />
          )}
          {(imgError || !god.image) && (
            <div style={{ width: 40, height: 40, borderRadius: 6, background: god.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              {god.name.slice(0, 1)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Orbitron', monospace", fontWeight: 700, fontSize: 13, color: god.color }}>
              {god.name.toUpperCase()}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "'Chakra Petch', sans-serif" }}>
              {god.title}
            </div>
          </div>
          <span style={{ color: "#475569", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
        {open && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p style={{ fontSize: 11, color: "#e2e8f0", margin: "0 0 8px", fontFamily: "'Chakra Petch', sans-serif" }}>
              <span style={{ color: god.color, fontWeight: 700 }}>Blessing: </span>
              {god.blessing}
            </p>
            {god.tip && (
              <p style={{ fontSize: 10, color: "#94a3b8", margin: 0, fontFamily: "'Chakra Petch', sans-serif" }}>
                {god.tip}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid " + god.color + "55", borderRadius: 10, overflow: "hidden", background: "rgba(15,22,41,0.7)" }}>
      <div style={{ display: "flex", gap: 14, padding: 14, alignItems: "flex-start" }}>
        <div style={{ flexShrink: 0 }}>
          {!imgError && god.image ? (
            <img
              src={god.image}
              alt={god.name}
              style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", border: "2px solid " + god.color + "66", display: "block" }}
              onError={() => setImgError(true)}
            />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: 8, background: god.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, border: "2px solid " + god.color + "44" }}>
              {god.name.slice(0, 1)}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Orbitron', monospace", fontWeight: 900, fontSize: 16, color: god.color, letterSpacing: 1 }}>
            {god.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Chakra Petch', sans-serif", marginBottom: 6 }}>
            {god.title}
          </div>
          <div style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "'Chakra Petch', sans-serif", marginBottom: 8 }}>
            <span style={{ color: god.color, fontWeight: 700 }}>Blessing: </span>
            {god.blessing}
          </div>
          {god.tip && (
            <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Chakra Petch', sans-serif", fontStyle: "italic" }}>
              {god.tip}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {["stage2", "stage3", "stage4"].map(function(stage, idx) {
          const labels = ["Stage 2", "Stage 3", "Stage 4"];
          const offerings = god.offerings && god.offerings[stage] ? god.offerings[stage] : [];
          return (
            <div key={stage} style={{ padding: "10px 12px", borderLeft: idx > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div style={{ fontSize: 10, fontFamily: "'Orbitron', monospace", color: god.color + "cc", marginBottom: 6, fontWeight: 700, letterSpacing: 0.5 }}>
                {labels[idx]}
              </div>
              {offerings.map(function(offer, i) {
                return (
                  <div key={i} style={{ fontSize: 10, color: "#cbd5e1", fontFamily: "'Chakra Petch', sans-serif", marginBottom: 3, paddingLeft: 8, borderLeft: "2px solid " + god.color + "44" }}>
                    {offer}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default GodCard;
