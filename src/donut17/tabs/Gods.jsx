import React, { useState } from "react";
import { C, F } from "../d17.js";

function TabHero({ eyebrow, title, sub, accentColor }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, " + accentColor + "12 0%, transparent 100%)",
      borderBottom: "1px solid " + C.border,
      padding: "32px 0 28px",
      marginBottom: 24,
    }}>
      <div style={{ fontSize: 11, fontFamily: F.headline, fontWeight: 700, color: accentColor, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6, opacity: 0.85 }}>{eyebrow}</div>
      <h2 style={{ fontFamily: F.headline, fontWeight: 800, fontSize: 42, textTransform: "uppercase", letterSpacing: -1, color: C.text, lineHeight: 1, margin: "0 0 10px" }}>{title}</h2>
      {sub && <p style={{ fontFamily: F.body, fontSize: 12, color: C.textDim, margin: 0, maxWidth: 500 }}>{sub}</p>}
    </div>
  );
}

function Gods({ gods }) {
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <TabHero eyebrow="Set 17 · Celestial Entities" title="Space Gods" sub="Choose one God each run. Blessings unlock at stages 2, 3, and 4." accentColor={C.tertiary} />

      {/* God portrait row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 6, marginBottom: 24 }}>
        {gods.map(function(god, idx) {
          const active = selected === idx;
          return <GodPortrait key={god.key} god={god} active={active} onClick={function() { setSelected(active ? null : idx); }} />;
        })}
      </div>

      {/* God cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {(selected !== null ? [gods[selected]] : gods).map(function(god) {
          return <GodFullCard key={god.key} god={god} />;
        })}
      </div>
    </div>
  );
}

function GodPortrait({ god, active, onClick }) {
  const [err, setErr] = useState(false);
  return (
    <div
      onClick={onClick}
      style={{ cursor: "pointer", border: "2px solid " + (active ? god.color : god.color + "44"), background: active ? god.color + "15" : C.surfaceLow, transition: "all 0.15s" }}
    >
      <div style={{ height: 72, overflow: "hidden" }}>
        {!err && god.image ? (
          <img src={god.image} alt={god.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }} onError={function() { setErr(true); }} />
        ) : (
          <div style={{ height: "100%", background: god.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
            {god.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div style={{ padding: "5px 7px" }}>
        <div style={{ fontFamily: F.headline, fontSize: 10, fontWeight: 700, color: active ? god.color : C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{god.name}</div>
        <div style={{ fontSize: 10, color: C.textDim, fontFamily: F.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{god.title}</div>
      </div>
    </div>
  );
}

function GodFullCard({ god }) {
  const [err, setErr] = useState(false);
  return (
    <div style={{ background: C.surface, display: "flex", overflow: "hidden" }}>
      {/* Portrait */}
      <div style={{ width: 200, minHeight: 200, flexShrink: 0, overflow: "hidden", position: "relative" }}>
        {!err && god.image ? (
          <img src={god.image} alt={god.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block", minHeight: 200 }} onError={function() { setErr(true); }} />
        ) : (
          <div style={{ height: 200, background: god.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56 }}>
            {god.name.slice(0, 1)}
          </div>
        )}
        {/* Gradient overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 50%, " + C.surface + " 100%)", pointerEvents: "none" }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "20px 24px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: F.headline, fontSize: 26, fontWeight: 700, textTransform: "uppercase", letterSpacing: -0.5, color: god.color, lineHeight: 1 }}>{god.name}</div>
            <div style={{ fontFamily: F.label, fontSize: 11, color: C.textDim, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>{god.title}</div>
          </div>
          {god.blessing && (
            <div style={{ background: god.color + "0d", border: "1px solid " + god.color + "44", padding: "8px 12px", maxWidth: 280, flexShrink: 1 }}>
              <div style={{ fontSize: 10, fontFamily: F.label, color: god.color, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>4-7 Blessing</div>
              <div style={{ fontSize: 11, fontFamily: F.body, color: C.textMuted }}>{god.blessing}</div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, borderTop: "1px solid " + C.border + "44", paddingTop: 16 }}>
          {["stage2", "stage3", "stage4"].map(function(stage, i) {
            const labels = ["Stage 2 Offerings", "Stage 3 Offerings", "Stage 4 Offerings"];
            const offerings = god.offerings && god.offerings[stage] ? god.offerings[stage] : [];
            return (
              <div key={stage}>
                <div style={{ fontSize: 11, fontFamily: F.label, color: C.secondary, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{labels[i]}</div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {offerings.map(function(offer, oi) {
                    return (
                      <li key={oi} style={{ display: "flex", gap: 6, marginBottom: 5, alignItems: "flex-start" }}>
                        <span style={{ color: god.color, fontSize: 8, marginTop: 2, flexShrink: 0 }}>&#9632;</span>
                        <span style={{ fontSize: 10, fontFamily: F.body, color: C.textMuted, lineHeight: 1.4 }}>{offer}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {god.tip && (
          <div style={{ marginTop: 14, borderTop: "1px solid " + C.border + "44", paddingTop: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ fontSize: 11, fontFamily: F.label, color: god.color, letterSpacing: 1, textTransform: "uppercase", flexShrink: 0, paddingTop: 1 }}>Tip</span>
            <span style={{ fontSize: 11, fontFamily: F.body, color: C.textDim, fontStyle: "italic", lineHeight: 1.5 }}>{god.tip}</span>
            {god.bestComps && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {god.bestComps.map(function(comp, ci) {
                  return (
                    <span key={ci} style={{ fontSize: 10, background: god.color + "15", color: god.color, padding: "1px 7px", fontFamily: F.label, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{comp}</span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Gods;
