import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  OrbField,
  GlassPanel,
  GlassPill,
  GlassIconButton,
  RainbowEdge,
} from './brosephtech/BTGlass';

// TFTTech is the secure portal that wraps both creator-side workspaces:
//   1. BrosephTech: private command center for the creator brand (Sebastian Lives).
//   2. TFT Clash: AI content engine for the platform itself (Gemini-backed).
// The PIN gate reuses the same SESSION_KEY as BrosephTech so unlocking once
// unlocks both children — no re-prompt when navigating between them.

var PIN = '1738';
var SESSION_KEY = 'bt_unlocked';

function TTIcon(props) {
  var filled = props.filled ? 'material-symbols-outlined font-filled' : 'material-symbols-outlined';
  return (
    <span className={filled + ' ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

function PinKeypad(props) {
  var keys = ['1','2','3','4','5','6','7','8','9','','0','back'];
  return (
    <div className="grid grid-cols-3 gap-3 w-60 mt-1">
      {keys.map(function(k, i) {
        if (k === '') return <div key={'empty-' + i} />;
        if (k === 'back') {
          return (
            <GlassIconButton
              key="back"
              shape="square"
              size={56}
              onClick={props.onBackspace}
              ariaLabel="Backspace"
              className="w-full"
            >
              <TTIcon name="backspace" className="text-lg" />
            </GlassIconButton>
          );
        }
        return (
          <GlassIconButton
            key={k}
            shape="square"
            size={56}
            onClick={function() { props.onPress(k); }}
            className="w-full text-base font-semibold"
          >
            {k}
          </GlassIconButton>
        );
      })}
    </div>
  );
}

function PinGate(props) {
  var [input, setInput] = React.useState('');
  var [error, setError] = React.useState(false);
  var [shake, setShake] = React.useState(false);
  var bufferRef = React.useRef('');
  var lockedRef = React.useRef(false);

  function tryUnlock(next) {
    if (next.length !== 4) return;
    lockedRef.current = true;
    if (next === PIN) {
      localStorage.setItem(SESSION_KEY, '1');
      setTimeout(function() { props.onUnlock(); }, 150);
    } else {
      setError(true);
      setShake(true);
      setTimeout(function() {
        setShake(false);
        setInput('');
        setError(false);
        bufferRef.current = '';
        lockedRef.current = false;
      }, 700);
    }
  }

  function handleKeyPress(k) {
    if (lockedRef.current) return;
    if (bufferRef.current.length >= 4) return;
    var next = bufferRef.current + k;
    bufferRef.current = next;
    setInput(next);
    setError(false);
    tryUnlock(next);
  }

  function handleBackspace() {
    if (lockedRef.current) return;
    bufferRef.current = bufferRef.current.slice(0, -1);
    setInput(bufferRef.current);
    setError(false);
  }

  React.useEffect(function() {
    function handleKeyboard(e) {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    }
    window.addEventListener('keydown', handleKeyboard);
    return function() { window.removeEventListener('keydown', handleKeyboard); };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4">
      <OrbField />

      <GlassPanel
        tone="medium"
        rounded="rounded-3xl"
        padding="px-7 py-8 sm:px-9 sm:py-10"
        glow="gold"
        className={'relative z-10 w-full max-w-sm flex flex-col items-center gap-6 ' + (shake ? 'animate-[bt-wiggle_0.5s]' : '')}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black tracking-tight"
            style={{
              background: 'linear-gradient(135deg, rgba(232,160,32,0.85) 0%, rgba(239,139,140,0.85) 50%, rgba(91,163,219,0.85) 100%)',
              color: '#0b0e1a',
              boxShadow: '0 12px 36px -8px rgba(232,160,32,0.55), inset 0 1px 0 rgba(255,255,255,0.4)',
              fontFamily: 'Subtle, system-ui, sans-serif',
            }}
          >
            TT
          </div>
          <RainbowEdge className="w-32" opacity={0.7} />
        </div>

        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight" style={{ fontFamily: 'Subtle, system-ui, sans-serif' }}>
            TFTTech
          </h1>
          <p className="text-xs text-white/55 mt-1.5 tracking-wide">Operator access only</p>
        </div>

        <div className="flex gap-3">
          {[0,1,2,3].map(function(i) {
            var filled = input.length > i;
            var err = error;
            var dotBg, dotBorder, dotText;
            if (err) {
              dotBg = 'rgba(239,68,68,0.18)';
              dotBorder = 'border-red-400/70';
              dotText = 'text-red-300';
            } else if (filled) {
              dotBg = 'rgba(232,160,32,0.20)';
              dotBorder = 'border-[#E8A020]/70';
              dotText = 'text-[#FFD487]';
            } else {
              dotBg = 'rgba(255,255,255,0.06)';
              dotBorder = 'border-white/15';
              dotText = 'text-white/30';
            }
            return (
              <div
                key={i}
                className={'w-12 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold transition-all backdrop-blur-xl border ' + dotBorder + ' ' + dotText}
                style={{
                  background: dotBg,
                  boxShadow: filled || err ? 'inset 0 1px 0 rgba(255,255,255,0.25)' : 'inset 0 1px 0 rgba(255,255,255,0.10)',
                }}
              >
                {filled ? 'o' : ''}
              </div>
            );
          })}
        </div>

        {error ? (
          <p className="text-red-300 text-sm font-medium">Wrong PIN</p>
        ) : (
          <p className="text-white/45 text-xs">Enter 4-digit PIN</p>
        )}

        <PinKeypad onPress={handleKeyPress} onBackspace={handleBackspace} />

        <p className="text-[11px] text-white/35 tracking-widest uppercase">TFTTech - Private</p>
      </GlassPanel>

      <style>{'@keyframes bt-wiggle { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }'}</style>
    </div>
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
          <GlassPill onClick={props.onLock} variant="ghost" size="sm" className="!gap-1">
            <TTIcon name="lock" className="text-base" />
            <span className="hidden sm:inline">Lock</span>
          </GlassPill>
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
            Both share the same gate, the same Gemini brain, and the same shipping cadence.
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
            accent="#FFD487"
            iconBg="linear-gradient(135deg, rgba(232,160,32,0.25), rgba(239,139,140,0.18))"
            washGradient="radial-gradient(120% 70% at 0% 0%, rgba(232,160,32,0.22) 0%, rgba(239,139,140,0.10) 40%, transparent 70%)"
            glow="gold"
          />

          <PortalCard
            onClick={function() { navigate('/content-engine'); }}
            kicker="Platform Engine"
            letter="C"
            icon="bolt"
            title="TFT Clash Studio"
            description="Gemini-powered content engine for the TFT Clash platform: generate, remix, and schedule platform-native posts across X, Reddit, Medium, and Instagram."
            features={['Generate', 'Campaign', 'Ideas', 'Library', 'Trends', 'Socials']}
            routeLabel="/content-engine"
            accent="#7DD3FC"
            iconBg="linear-gradient(135deg, rgba(91,163,219,0.28), rgba(125,211,252,0.18))"
            washGradient="radial-gradient(120% 70% at 100% 0%, rgba(91,163,219,0.22) 0%, rgba(125,211,252,0.10) 40%, transparent 70%)"
            glow="teal"
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
              <p className="text-sm text-white font-bold leading-none mt-0.5">Single PIN, both worlds</p>
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
  var [unlocked, setUnlocked] = React.useState(function() {
    return localStorage.getItem(SESSION_KEY) === '1';
  });

  function handleUnlock() {
    setUnlocked(true);
  }

  function handleLock() {
    localStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
  }

  if (!unlocked) {
    return <PinGate onUnlock={handleUnlock} />;
  }

  return <PortalSelector navigate={navigate} onLock={handleLock} />;
}

export default TfttechScreen;
