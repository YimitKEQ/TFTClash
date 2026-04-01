import React, { useState, useEffect } from "react";
import { C, F } from "./d17.js";
import championsData from "./data/champions.json";
import traitsData from "./data/traits.json";
import godsData from "./data/gods.json";
import compLinesData from "./data/comp_lines.json";

import OpenerAdvisor from "./tabs/OpenerAdvisor.jsx";
import Augments from "./tabs/Augments.jsx";
import Champions from "./tabs/Champions.jsx";
import CompLines from "./tabs/CompLines.jsx";
import Gods from "./tabs/Gods.jsx";
import Items from "./tabs/Items.jsx";
import TeamBuilder from "./tabs/TeamBuilder.jsx";

var TABS = [
  { id: "opener",   label: "Opener",    icon: "grid_view" },
  { id: "builder",  label: "Builder",   icon: "dashboard" },
  { id: "comps",    label: "Comps",     icon: "bar_chart" },
  { id: "champs",   label: "Champions", icon: "group" },
  { id: "items",    label: "Items",     icon: "shield" },
  { id: "augments", label: "Augments",  icon: "auto_awesome" },
  { id: "gods",     label: "Gods",      icon: "military_tech" },
];

function MSIcon(props) {
  var name = props.name;
  var size = props.size || 20;
  var extra = props.style || {};
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
  var _state = useState("opener");
  var tab = _state[0];
  var setTab = _state[1];

  useEffect(function() {
    var fontId = "d17-fonts";
    if (!document.getElementById(fontId)) {
      var link = document.createElement("link");
      link.id = fontId;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
    var iconId = "d17-msymbols";
    if (!document.getElementById(iconId)) {
      var link2 = document.createElement("link");
      link2.id = iconId;
      link2.rel = "stylesheet";
      link2.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200";
      document.head.appendChild(link2);
    }
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: F.body }}>

      {/* Cosmic background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 25% 20%, rgba(200,184,255,0.13) 0%, transparent 50%), radial-gradient(ellipse at 80% 65%, rgba(125,200,255,0.09) 0%, transparent 45%), radial-gradient(ellipse at 60% 90%, rgba(124,58,237,0.06) 0%, transparent 40%)"
      }} />

      {/* Sticky top nav */}
      <header style={{
        position: "sticky", top: 0, left: 0, right: 0, height: 52, zIndex: 50,
        background: "rgba(11,8,19,0.95)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid " + C.border,
        display: "flex", alignItems: "center",
        padding: "0 24px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
      }}>
        {/* Brand text with gradient */}
        <div style={{
          fontFamily: F.headline, fontWeight: 900, fontSize: 22,
          letterSpacing: 3, textTransform: "uppercase",
          background: "linear-gradient(135deg, #c8b8ff 0%, #7dc8ff 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          flexShrink: 0,
        }}>
          DONUT 17
        </div>

        {/* Set badge pill */}
        <div style={{
          marginLeft: 16, flexShrink: 0,
          padding: "3px 10px", borderRadius: 999,
          background: C.surfaceHigh, border: "1px solid " + C.border,
          fontFamily: F.label, fontSize: 10, fontWeight: 600,
          color: C.textMuted, letterSpacing: 0.5, whiteSpace: "nowrap",
        }}>
          Set 17 - Space Gods
        </div>

        {/* Tab buttons pushed right */}
        <nav style={{ display: "flex", alignItems: "stretch", height: 52, gap: 0, marginLeft: "auto" }}>
          {TABS.map(function(t) {
            var active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={function() { setTab(t.id); }}
                style={{
                  padding: "0 14px",
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid transparent" : "2px solid transparent",
                  borderImage: active ? "linear-gradient(90deg, #c8b8ff, #7dc8ff) 1" : "none",
                  color: active ? "#ffffff" : C.textDim,
                  fontFamily: F.headline,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  cursor: "pointer",
                  transition: "color 0.15s, border-color 0.15s",
                  whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <MSIcon name={t.icon} size={16} style={{ color: active ? "#ffffff" : C.textDim }} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main content - no sidebar offset */}
      <main style={{ paddingTop: 24, paddingBottom: 60, minHeight: "calc(100vh - 52px)", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px" }}>
          <React.Suspense fallback={null}>
            {tab === "opener"  && <OpenerAdvisor champions={championsData} traits={traitsData} compLines={compLinesData} />}
            {tab === "builder" && <TeamBuilder   champions={championsData} traits={traitsData} />}
            {tab === "augments" && <Augments />}
            {tab === "champs"  && <Champions      champions={championsData} traits={traitsData} />}
            {tab === "comps"   && <CompLines      compLines={compLinesData} champions={championsData} />}
            {tab === "items"   && <Items />}
            {tab === "gods"    && <Gods           gods={godsData} />}
          </React.Suspense>
        </div>
        <footer style={{ marginTop: 48, borderTop: "1px solid " + C.border, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: F.headline, fontWeight: 700, fontSize: 12, color: C.border, letterSpacing: 2, textTransform: "uppercase" }}>DONUT17</span>
          <span style={{ fontFamily: F.label, fontSize: 9, color: C.border, letterSpacing: 1, textTransform: "uppercase" }}>v17 PBE - for the homies only - not affiliated with riot</span>
        </footer>
      </main>
    </div>
  );
}

export default Donut17Page;
