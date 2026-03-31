import React, { useState } from "react";
import GodCard from "../components/GodCard.jsx";

function Gods({ gods }) {
  const [selected, setSelected] = useState(null);
  const activeGod = selected !== null ? gods[selected] : null;

  return (
    <div>
      <h2 style={{ fontFamily: "'Orbitron', monospace", fontSize: 16, color: "#a78bfa", margin: "0 0 6px", fontWeight: 700, letterSpacing: 1 }}>
        REALM OF THE GODS
      </h2>
      <p style={{ fontSize: 11, color: "#475569", fontFamily: "'Chakra Petch', sans-serif", margin: "0 0 16px" }}>
        Each run you choose one God. Your God's offerings unlock at stages 2, 3, and 4. The 4-7 blessing is always active.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 20 }}>
        {gods.map(function(god, idx) {
          const isActive = selected === idx;
          return (
            <GodPortrait
              key={god.key}
              god={god}
              active={isActive}
              onClick={function() { setSelected(isActive ? null : idx); }}
            />
          );
        })}
      </div>

      {activeGod ? (
        <div>
          <GodCard god={activeGod} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {gods.map(function(god) {
            return <GodCard key={god.key} god={god} />;
          })}
        </div>
      )}
    </div>
  );
}

function GodPortrait({ god, active, onClick }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div
      style={{ border: "2px solid " + (active ? god.color : god.color + "44"), borderRadius: 8, overflow: "hidden", cursor: "pointer", background: active ? god.color + "15" : "rgba(15,22,41,0.5)", transition: "all 0.15s", position: "relative" }}
      onClick={onClick}
    >
      {!imgError && god.image ? (
        <img
          src={god.image}
          alt={god.name}
          style={{ width: "100%", height: 80, objectFit: "cover", objectPosition: "top", display: "block" }}
          onError={function() { setImgError(true); }}
        />
      ) : (
        <div style={{ height: 80, background: god.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
          {god.name.slice(0, 1)}
        </div>
      )}
      <div style={{ padding: "6px 8px" }}>
        <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 10, color: god.color, fontWeight: 700, letterSpacing: 0.5 }}>
          {god.name.toUpperCase()}
        </div>
        <div style={{ fontSize: 9, color: "#64748b", fontFamily: "'Chakra Petch', sans-serif", lineHeight: 1.3, marginTop: 2 }}>
          {god.title}
        </div>
      </div>
    </div>
  );
}

export default Gods;
