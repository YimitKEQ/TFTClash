import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  OrbField,
  GlassPanel,
  RainbowEdge,
} from './brosephtech/BTGlass';

// TFTTech is the launcher that links to both private workspaces.
// The portal itself is unguarded; each child owns its own PIN gate.
//   - BrosephTech: PIN 1738, session key bt_unlocked
//   - TFT Clash Studio: PIN 133199, session key tcs_unlocked

function TTIcon(props) {
  var filled = props.filled ? 'material-symbols-outlined font-filled' : 'material-symbols-outlined';
  return (
    <span className={filled + ' ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

// Each portal card represents one workspace. Hover lifts it; click navigates.
// Visual identity: BrosephTech leans gold/pink (creator brand). TFT Clash leans
// teal/violet (platform brand). Both share the glass treatment for cohesion.
function PortalCard(props) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="group relative text-left w-full transition-transform duration-300 hover:-translate-y-1"
    >
      <GlassPanel
        tone="medium"
        rounded="rounded-3xl"
        padding="p-7 sm:p-9"
        glow={props.glow}
        className="relative overflow-hidden h-full min-h-[340px] flex flex-col justify-between"
      >
        {/* Branded gradient wash */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-500 group-hover:opacity-80"
          style={{ background: props.washGradient }}
          aria-hidden="true"
        />
        {/* Decorative oversize letter */}
        <div
          className="pointer-events-none absolute -top-12 -right-6 text-[180px] font-black leading-none opacity-[0.06] tracking-tighter"
          style={{ color: props.accent, fontFamily: 'Subtle, system-ui, sans-serif' }}
          aria-hidden="true"
        >
          {props.letter}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: props.iconBg,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 24px -10px ' + props.accent,
              }}
            >
              <TTIcon name={props.icon} className="text-2xl" style={{ color: props.accent }} />
            </div>
            <span
              className="text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ color: props.accent }}
            >
              {props.kicker}
            </span>
          </div>

          <h2
            className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3"
            style={{ fontFamily: 'Subtle, system-ui, sans-serif' }}
          >
            {props.title}
          </h2>
          <p className="text-sm text-white/65 leading-relaxed mb-5">
            {props.description}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {props.features.map(function(f) {
              return (
                <span
                  key={f}
                  className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-md border border-white/15 bg-white/[0.06] text-white/75"
                >
                  {f}
                </span>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between mt-6 pt-5 border-t border-white/10">
          <span className="text-[11px] text-white/50 font-mono uppercase tracking-wider">
            {props.routeLabel}
          </span>
          <span
            className="flex items-center gap-1.5 text-sm font-bold transition-transform duration-300 group-hover:translate-x-1"
            style={{ color: props.accent }}
          >
            Enter
            <TTIcon name="arrow_forward" className="text-base" />
          </span>
        </div>
      </GlassPanel>
    </button>
  );
}

function PortalSelector(props) {
  var navigate = props.navigate;

  return (
    <div className="min-h-screen relative text-white overflow-hidden">
      <OrbField />

      <div
        className="sticky top-0 z-40 backdrop-blur-2xl border-b border-white/12"
        style={{
          background: 'rgba(8,11,22,0.62)',
          boxShadow: '0 8px 24px -10px rgba(5,8,20,0.6), inset 0 1px 0 rgba(255,255,255,0.10)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(232,160,32,0.85) 0%, rgba(239,139,140,0.85) 50%, rgba(91,163,219,0.85) 100%)',
                color: '#0b0e1a',
                boxShadow: '0 4px 14px -4px rgba(232,160,32,0.55), inset 0 1px 0 rgba(255,255,255,0.4)',
                fontFamily: 'Subtle, system-ui, sans-serif',
              }}
            >
              TT
            </div>
            <div className="min-w-0">
              <h1
                className="text-base sm:text-lg font-bold text-white leading-none tracking-tight truncate"
                style={{ fontFamily: 'Subtle, system-ui, sans-serif' }}
              >
                TFTTECH
              </h1>
              <p className="text-[10px] sm:text-xs text-[#FFD487] leading-none mt-1 tracking-wider font-semibold">
                OPERATOR PORTAL
              </p>
            </div>
          </div>
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.65)',
              fontFamily: 'Subtle, system-ui, sans-serif',
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: '#34D399', boxShadow: '0 0 10px rgba(52,211,153,0.7)' }}
              aria-hidden="true"
            />
            Live
          </div>
        </div>
        <RainbowEdge opacity={0.55} />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center mb-10 sm:mb-14">
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.3em] text-[#FFD487] mb-3">
            Choose your workspace
          </p>
          <h2
            className="text-3xl sm:text-5xl font-bold text-white tracking-tight"
            style={{ fontFamily: 'Subtle, system-ui, sans-serif' }}
          >
            Two brands. One control room.
          </h2>
          <p className="text-sm sm:text-base text-white/55 mt-3 max-w-xl mx-auto">
            BrosephTech runs the creator brand. TFT Clash runs the platform.
            Each workspace has its own PIN gate, the same Gemini brain, the same shipping cadence.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-7">
          <PortalCard
            onClick={function() { navigate('/brosephtech'); }}
            kicker="Creator Brand"
            letter="B"
            icon="auto_awesome"
            title="BrosephTech"
            description="Private command center for the Sebastian Lives content stack: planning, scripting, marketing lab, tier lists, and production SOPs."
            features={['Content Board', 'Schedule', 'Studio', 'Marketing Lab', 'Tier Lists', 'Metrics', 'SOPs']}
            routeLabel="/brosephtech"
            accent="#F4A4A8"
            iconBg="linear-gradient(135deg, rgba(244,164,168,0.28), rgba(239,139,140,0.18))"
            washGradient="radial-gradient(120% 70% at 0% 0%, rgba(244,164,168,0.22) 0%, rgba(239,139,140,0.10) 40%, transparent 70%)"
            glow="pink"
          />

          <PortalCard
            onClick={function() { navigate('/content-engine'); }}
            kicker="Platform Engine"
            letter="C"
            icon="bolt"
            title="TFT Clash Studio"
            description="Gemini-powered daily drop machine for the TFT Clash platform: nine surfaces (X, Reddit, TikTok, YT Shorts, IG, Threads, Bluesky, LinkedIn, Medium), one-click adapt, scheduler, and idea inbox."
            features={['Daily Drop', 'Idea Inbox', 'Generate', 'Library', 'Trends', 'Socials']}
            routeLabel="/content-engine"
            accent="#FFD487"
            iconBg="linear-gradient(135deg, rgba(232,168,56,0.30), rgba(232,168,56,0.10))"
            washGradient="radial-gradient(120% 70% at 100% 0%, rgba(232,168,56,0.26) 0%, rgba(255,212,135,0.10) 40%, transparent 70%)"
            glow="gold"
          />
        </div>

        <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            className="px-4 py-3 rounded-2xl backdrop-blur-xl border border-white/10 flex items-center gap-3"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <TTIcon name="memory" className="text-xl text-[#7DD3FC]" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Brain</p>
              <p className="text-sm text-white font-bold leading-none mt-0.5">Gemini 2.5 Flash</p>
            </div>
          </div>
          <div
            className="px-4 py-3 rounded-2xl backdrop-blur-xl border border-white/10 flex items-center gap-3"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <TTIcon name="lock" className="text-xl text-[#FFD487]" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Auth</p>
              <p className="text-sm text-white font-bold leading-none mt-0.5">Per-property PINs</p>
            </div>
          </div>
          <div
            className="px-4 py-3 rounded-2xl backdrop-blur-xl border border-white/10 flex items-center gap-3"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <TTIcon name="bolt" className="text-xl text-[#EF8B8C]" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">Status</p>
              <p className="text-sm text-white font-bold leading-none mt-0.5">Live</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TfttechScreen() {
  var navigate = useNavigate();
  return <PortalSelector navigate={navigate} />;
}

export default TfttechScreen;
