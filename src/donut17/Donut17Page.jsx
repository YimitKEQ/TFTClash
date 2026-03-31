import React, { useState, useEffect } from "react";
import championsData from "./data/champions.json";
import traitsData from "./data/traits.json";
import godsData from "./data/gods.json";
import compLinesData from "./data/comp_lines.json";
import OpenerAdvisor from "./tabs/OpenerAdvisor.jsx";
import SynergyGrid from "./tabs/SynergyGrid.jsx";
import Champions from "./tabs/Champions.jsx";
import CompLines from "./tabs/CompLines.jsx";
import Gods from "./tabs/Gods.jsx";

const TABS = [
  { id: "opener", label: "OPENER ADVISOR", icon: "&#127775;" },
  { id: "grid", label: "SYNERGY GRID", icon: "&#9783;" },
  { id: "champs", label: "CHAMPIONS", icon: "&#9876;" },
  { id: "comps", label: "COMP LINES", icon: "&#128202;" },
  { id: "gods", label: "GODS", icon: "&#128293;" },
];

const D17_STYLES = {
  "--d17-bg-deep": "#080c18",
  "--d17-bg-surface": "#0f1629",
  "--d17-bg-card": "rgba(15, 23, 42, 0.5)",
  "--d17-border": "#1e293b",
  "--d17-text-primary": "#e2e8f0",
  "--d17-text-secondary": "#94a3b8",
  "--d17-text-muted": "#475569",
  "--d17-accent-purple": "#a78bfa",
  "--d17-accent-blue": "#60a5fa",
};

function Donut17Page() {
  const [activeTab, setActiveTab] = useState("opener");

  // Load custom fonts for this page only
  useEffect(function() {
    const id = "donut17-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Chakra+Petch:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap";
    document.head.appendChild(link);
    return function() {
      // Leave font loaded - no harm in keeping it
    };
  }, []);

  const rootStyle = Object.assign({
    minHeight: "100vh",
    background: "#080c18",
    fontFamily: "'Chakra Petch', sans-serif",
    color: "#e2e8f0",
    position: "relative",
    overflow: "hidden",
  }, D17_STYLES);

  return (
    <div style={rootStyle}>
      {/* Starfield background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 20%, rgba(167,139,250,0.08) 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 80% 80%, rgba(96,165,250,0.06) 0%, transparent 60%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "0 16px 40px" }}>

        {/* Header */}
        <div style={{ paddingTop: 24, paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontFamily: "'Orbitron', monospace", fontWeight: 900, fontSize: 22, letterSpacing: 2, color: "#a78bfa", lineHeight: 1 }}>
                DONUT17
              </div>
              <div style={{ fontSize: 11, color: "#475569", fontFamily: "'Chakra Petch', sans-serif", marginTop: 4, letterSpacing: 1 }}>
                TFT SET 17: SPACE GODS - PREP TOOL
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 10, color: "#334155", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
                <div>{championsData.length} champions</div>
                <div>{traitsData.length} traits</div>
              </div>
              <div style={{ width: 1, height: 28, background: "#1e293b" }} />
              <div style={{ fontSize: 10, color: "#334155", fontFamily: "'JetBrains Mono', monospace" }}>
                PBE data
              </div>
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: "flex", gap: 2, marginBottom: 20, overflowX: "auto", paddingBottom: 2 }}>
          {TABS.map(function(tab) {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={function() { setActiveTab(tab.id); }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid " + (active ? "#a78bfa44" : "#1e293b"),
                  background: active ? "rgba(167,139,250,0.12)" : "transparent",
                  color: active ? "#a78bfa" : "#475569",
                  fontFamily: "'Orbitron', monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                <span dangerouslySetInnerHTML={{ __html: tab.icon }} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div style={{ background: "rgba(15,22,41,0.5)", border: "1px solid #1e293b", borderRadius: 10, padding: "18px 16px" }}>
          {activeTab === "opener" && (
            <OpenerAdvisor champions={championsData} traits={traitsData} compLines={compLinesData} />
          )}
          {activeTab === "grid" && (
            <SynergyGrid champions={championsData} traits={traitsData} />
          )}
          {activeTab === "champs" && (
            <Champions champions={championsData} traits={traitsData} />
          )}
          {activeTab === "comps" && (
            <CompLines compLines={compLinesData} champions={championsData} />
          )}
          {activeTab === "gods" && (
            <Gods gods={godsData} />
          )}
        </div>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 10, color: "#1e293b", fontFamily: "'JetBrains Mono', monospace" }}>
          donut17 - not affiliated with riot games - for the homies only
        </div>
      </div>
    </div>
  );
}

export default Donut17Page;
