import React, { useState, useEffect } from "react";
import { C, F } from "./d17.js";
import championsData from "./data/champions.json";
import traitsData from "./data/traits.json";
import godsData from "./data/gods.json";
import compLinesData from "./data/comp_lines.json";

import OpenerAdvisor from "./tabs/OpenerAdvisor.jsx";
import SynergyGrid from "./tabs/SynergyGrid.jsx";
import Champions from "./tabs/Champions.jsx";
import CompLines from "./tabs/CompLines.jsx";
import Gods from "./tabs/Gods.jsx";
import Items from "./tabs/Items.jsx";
import TeamBuilder from "./tabs/TeamBuilder.jsx";

const TABS = [
  { id: "opener",  label: "Opener Advisor", icon: "grid_view" },
  { id: "builder", label: "Team Builder",   icon: "dashboard" },
  { id: "grid",    label: "Synergy Grid",   icon: "hub" },
  { id: "champs",  label: "Champions",      icon: "group" },
  { id: "comps",   label: "Comp Lines",     icon: "bar_chart" },
  { id: "items",   label: "Items",          icon: "shield" },
  { id: "gods",    label: "Gods",           icon: "military_tech" },
];

const ACCENTCOLORS = {
  opener:  C.primary,
  builder: C.primary,
  grid:    C.secondary,
  champs:  C.primary,
  comps:   C.tertiary,
  items:   C.secondary,
  gods:    C.tertiary,
};

function MSIcon({ name, size = 20, style: extra }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: size, lineHeight: 1, display: "inline-block", ...extra }}
    >
      {name}
    </span>
  );
}

function Donut17Page() {
  const [tab, setTab] = useState("opener");

  useEffect(function() {
    const fontId = "d17-fonts";
    if (!document.getElementById(fontId)) {
      const link = document.createElement("link");
      link.id = fontId;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
    const iconId = "d17-msymbols";
    if (!document.getElementById(iconId)) {
      const link2 = document.createElement("link");
      link2.id = iconId;
      link2.rel = "stylesheet";
      link2.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200";
      document.head.appendChild(link2);
    }
  }, []);

  const accentColor = ACCENTCOLORS[tab] || C.primary;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: F.body }}>

      {/* Nebula bg */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(circle at 40% 30%, rgba(205,189,255,0.07) 0%, transparent 55%), radial-gradient(circle at 80% 70%, rgba(141,205,255,0.05) 0%, transparent 45%)"
      }} />

      {/* Fixed header */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 50,
        background: C.bg + "e8", backdropFilter: "blur(16px)",
        borderBottom: "1px solid " + C.border,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px 0 80px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ fontFamily: F.headline, fontWeight: 700, fontSize: 16, letterSpacing: 2, color: C.text, textTransform: "uppercase" }}>
            DONUT<span style={{ color: C.primary }}>17</span>
          </div>
          <nav style={{ display: "flex", alignItems: "stretch", height: 56, gap: 0 }}>
            {TABS.map(function(t) {
              const active = tab === t.id;
              const col = ACCENTCOLORS[t.id];
              return (
                <button
                  key={t.id}
                  onClick={function() { setTab(t.id); }}
                  style={{
                    padding: "0 16px",
                    background: active ? col + "0d" : "transparent",
                    border: "none",
                    borderBottom: active ? ("2px solid " + col) : "2px solid transparent",
                    color: active ? col : C.textDim,
                    fontFamily: F.headline,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    cursor: "pointer",
                    transition: "color 0.15s, border-color 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 10, fontFamily: F.label, color: C.textDim, letterSpacing: 1 }}>
          <span style={{ color: C.border }}>|</span>
          <span>{championsData.length} CHAMPIONS</span>
          <span style={{ color: C.border }}>|</span>
          <span>{traitsData.length} TRAITS</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ color: accentColor }}>PBE DATA</span>
        </div>
      </header>

      {/* Fixed left sidebar */}
      <aside style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 64, zIndex: 40,
        background: C.surfaceLow + "f0", backdropFilter: "blur(12px)",
        borderRight: "1px solid " + C.border,
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingTop: 72, gap: 4,
      }}>
        {TABS.map(function(t) {
          const active = tab === t.id;
          const col = ACCENTCOLORS[t.id];
          return (
            <button
              key={t.id}
              onClick={function() { setTab(t.id); }}
              title={t.label}
              style={{
                width: "100%",
                padding: "10px 0",
                background: active ? col + "15" : "transparent",
                border: "none",
                borderLeft: active ? ("3px solid " + col) : "3px solid transparent",
                color: active ? col : C.textDim,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                transition: "all 0.15s",
              }}
            >
              <MSIcon name={t.icon} size={18} />
              <span style={{ fontSize: 9, fontFamily: F.label, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                {t.id === "opener" ? "HUD" : t.id === "builder" ? "BUILD" : t.id === "grid" ? "GRID" : t.id === "champs" ? "UNITS" : t.id === "comps" ? "COMPS" : t.id === "items" ? "ITEMS" : "GODS"}
              </span>
            </button>
          );
        })}
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: 64, paddingTop: 72, paddingBottom: 48, minHeight: "100vh", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}>
          <React.Suspense fallback={null}>
            {tab === "opener"  && <OpenerAdvisor champions={championsData} traits={traitsData} compLines={compLinesData} />}
            {tab === "builder" && <TeamBuilder   champions={championsData} traits={traitsData} />}
            {tab === "grid"    && <SynergyGrid   champions={championsData} traits={traitsData} />}
            {tab === "champs"  && <Champions      champions={championsData} traits={traitsData} />}
            {tab === "comps"   && <CompLines      compLines={compLinesData} champions={championsData} />}
            {tab === "items"   && <Items />}
            {tab === "gods"    && <Gods           gods={godsData} />}
          </React.Suspense>
        </div>
        <footer style={{ marginTop: 48, borderTop: "1px solid " + C.border, padding: "16px 24px 16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: F.headline, fontWeight: 700, fontSize: 12, color: C.border, letterSpacing: 2, textTransform: "uppercase" }}>DONUT17</span>
          <span style={{ fontFamily: F.label, fontSize: 9, color: C.border, letterSpacing: 1, textTransform: "uppercase" }}>v17 PBE — for the homies only — not affiliated with riot</span>
        </footer>
      </main>
    </div>
  );
}

export default Donut17Page;
