import React from 'react';

// Glass primitives for the BrosephTech Command Center.
// Palette: Pink #EF8B8C, Gold #E8A020, Teal #3D8FA0, Rose Mist #EF0BF4, Frosted White.

var ORB_DEFINITIONS = [
  { color: '239,139,140', top: '-10%', left: '-8%', size: 520, opacity: 0.55, drift: 'bt-orb-drift-a' },
  { color: '232,160,32',  top: '8%',   left: '62%', size: 480, opacity: 0.45, drift: 'bt-orb-drift-b' },
  { color: '61,143,160',  top: '55%',  left: '-12%', size: 560, opacity: 0.40, drift: 'bt-orb-drift-c' },
  { color: '239,11,244',  top: '70%',  left: '70%',  size: 420, opacity: 0.32, drift: 'bt-orb-drift-d' },
  { color: '91,163,219',  top: '38%',  left: '38%',  size: 360, opacity: 0.28, drift: 'bt-orb-drift-e' },
];

function OrbField(props) {
  var density = props.density || 'full';
  var orbs = density === 'compact' ? ORB_DEFINITIONS.slice(0, 3) : ORB_DEFINITIONS;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Base wash so orbs glow against a deep slate */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% -10%, #1a1f36 0%, #0b0e1a 60%, #05070f 100%)' }}
      />
      {orbs.map(function(orb, idx) {
        var rgb = 'rgba(' + orb.color + ',' + orb.opacity + ')';
        var bg = 'radial-gradient(circle at 30% 30%, ' + rgb + ' 0%, rgba(' + orb.color + ',0) 65%)';
        return (
          <div
            key={'orb-' + idx}
            className={'absolute rounded-full ' + orb.drift}
            style={{
              top: orb.top,
              left: orb.left,
              width: orb.size,
              height: orb.size,
              background: bg,
              filter: 'blur(60px)',
              mixBlendMode: 'screen',
            }}
          />
        );
      })}
      {/* Refraction streaks - subtle horizontal bands */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          background: 'linear-gradient(115deg, transparent 18%, rgba(239,139,140,0.35) 28%, rgba(232,160,32,0.35) 42%, rgba(61,143,160,0.35) 58%, rgba(239,11,244,0.30) 72%, transparent 86%)',
          mixBlendMode: 'screen',
          filter: 'blur(40px)',
        }}
      />
      {/* Grain so the glass reads as physical glass not flat blur */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '3px 3px',
          mixBlendMode: 'overlay',
        }}
      />
      <OrbKeyframes />
    </div>
  );
}

function OrbKeyframes() {
  var css = [
    '@keyframes bt-drift-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,30px) scale(1.05); } }',
    '@keyframes bt-drift-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,40px) scale(1.08); } }',
    '@keyframes bt-drift-c { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(50px,-20px) scale(0.95); } }',
    '@keyframes bt-drift-d { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,-30px) scale(1.06); } }',
    '@keyframes bt-drift-e { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,-40px) scale(1.04); } }',
    '.bt-orb-drift-a { animation: bt-drift-a 24s ease-in-out infinite; }',
    '.bt-orb-drift-b { animation: bt-drift-b 28s ease-in-out infinite; }',
    '.bt-orb-drift-c { animation: bt-drift-c 32s ease-in-out infinite; }',
    '.bt-orb-drift-d { animation: bt-drift-d 26s ease-in-out infinite; }',
    '.bt-orb-drift-e { animation: bt-drift-e 30s ease-in-out infinite; }',
    '@media (prefers-reduced-motion: reduce) {',
    '  .bt-orb-drift-a,.bt-orb-drift-b,.bt-orb-drift-c,.bt-orb-drift-d,.bt-orb-drift-e { animation: none; }',
    '}',
  ].join(' ');
  return <style>{css}</style>;
}

// GlassPanel: frosted card with refraction edge and soft inner highlight.
// tone prop: 'light' (60%), 'medium' (40%), 'subtle' (20%), 'deep' (75%)
function GlassPanel(props) {
  var tone = props.tone || 'medium';
  var rounded = props.rounded || 'rounded-2xl';
  var padding = props.padding == null ? 'p-5' : props.padding;
  var glow = props.glow ? glowFor(props.glow) : null;

  var baseBg;
  if (tone === 'light') baseBg = 'rgba(255,255,255,0.16)';
  else if (tone === 'subtle') baseBg = 'rgba(255,255,255,0.06)';
  else if (tone === 'deep') baseBg = 'rgba(13,17,32,0.78)';
  else baseBg = 'rgba(255,255,255,0.10)';

  var blur = tone === 'subtle' ? 'backdrop-blur-md' : tone === 'deep' ? 'backdrop-blur-xl' : 'backdrop-blur-2xl';

  var classes = [
    'relative isolate',
    rounded,
    padding,
    blur,
    'border border-white/15',
    'shadow-[0_18px_60px_-20px_rgba(5,8,20,0.7)]',
    props.className || '',
  ].join(' ');

  return (
    <div
      className={classes}
      style={Object.assign({
        background: baseBg,
        boxShadow: '0 18px 60px -20px rgba(5,8,20,0.7), inset 0 1px 0 rgba(255,255,255,0.18)',
      }, props.style || {})}
      onClick={props.onClick}
    >
      {/* Inner refraction line along the top */}
      <div
        className={'pointer-events-none absolute inset-x-0 top-0 h-px ' + rounded}
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
        }}
      />
      {/* Optional colored glow halo */}
      {glow ? (
        <div
          className={'pointer-events-none absolute -inset-px ' + rounded}
          style={{ boxShadow: glow, opacity: 0.7 }}
        />
      ) : null}
      {props.children}
    </div>
  );
}

function glowFor(color) {
  if (color === 'pink')  return '0 0 0 1px rgba(239,139,140,0.35), 0 12px 40px -12px rgba(239,139,140,0.5)';
  if (color === 'gold')  return '0 0 0 1px rgba(232,160,32,0.40), 0 12px 40px -12px rgba(232,160,32,0.55)';
  if (color === 'teal')  return '0 0 0 1px rgba(61,143,160,0.40), 0 12px 40px -12px rgba(61,143,160,0.55)';
  if (color === 'rose')  return '0 0 0 1px rgba(239,11,244,0.35), 0 12px 40px -12px rgba(239,11,244,0.5)';
  if (color === 'blue')  return '0 0 0 1px rgba(91,163,219,0.40), 0 12px 40px -12px rgba(91,163,219,0.55)';
  return null;
}

// GlassPill: pill-shaped button. variant 'solid' for active, 'ghost' for inactive.
function GlassPill(props) {
  var variant = props.variant || 'ghost';
  var size = props.size || 'md';
  var pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-5 py-3 text-sm' : 'px-4 py-2 text-sm';

  var bg, border, text, shadow;
  if (variant === 'solid') {
    bg = 'rgba(255,255,255,0.20)';
    border = 'border-white/30';
    text = 'text-white';
    shadow = 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 24px -8px rgba(255,255,255,0.18)';
  } else if (variant === 'gold') {
    bg = 'rgba(232,160,32,0.22)';
    border = 'border-[#E8A020]/55';
    text = 'text-[#FFD487]';
    shadow = 'inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 24px -8px rgba(232,160,32,0.55)';
  } else if (variant === 'pink') {
    bg = 'rgba(239,139,140,0.22)';
    border = 'border-[#EF8B8C]/55';
    text = 'text-[#FFC9CA]';
    shadow = 'inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 24px -8px rgba(239,139,140,0.55)';
  } else {
    bg = 'rgba(255,255,255,0.06)';
    border = 'border-white/12';
    text = 'text-white/70';
    shadow = 'inset 0 1px 0 rgba(255,255,255,0.10)';
  }

  var classes = [
    'inline-flex items-center gap-2 rounded-full font-semibold tracking-wide transition-all',
    'backdrop-blur-xl border',
    border,
    text,
    pad,
    'hover:text-white hover:bg-white/15',
    props.className || '',
  ].join(' ');

  return (
    <button
      type={props.type || 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      className={classes}
      style={{ background: bg, boxShadow: shadow }}
    >
      {props.children}
    </button>
  );
}

// GlassIconButton: square or circular icon button used in PIN keypad and tab strips.
function GlassIconButton(props) {
  var shape = props.shape === 'square' ? 'rounded-2xl' : 'rounded-full';
  var size = props.size || 48;
  var active = !!props.active;

  var bg = active ? 'rgba(232,160,32,0.22)' : 'rgba(255,255,255,0.08)';
  var border = active ? 'border-[#E8A020]/55' : 'border-white/15';
  var text = active ? 'text-[#FFD487]' : 'text-white/80';

  var classes = [
    'inline-flex items-center justify-center backdrop-blur-xl border transition-all',
    shape,
    border,
    text,
    'hover:text-white hover:bg-white/15',
    props.className || '',
  ].join(' ');

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.ariaLabel}
      className={classes}
      style={{
        width: size,
        height: size,
        background: bg,
        boxShadow: active
          ? 'inset 0 1px 0 rgba(255,255,255,0.30), 0 6px 24px -8px rgba(232,160,32,0.55)'
          : 'inset 0 1px 0 rgba(255,255,255,0.18)',
      }}
    >
      {props.children}
    </button>
  );
}

// GlassFAB: circular floating action button with strong frosted glass.
function GlassFAB(props) {
  var classes = [
    'inline-flex items-center justify-center rounded-full',
    'backdrop-blur-2xl border border-white/25 text-white',
    'transition-all hover:scale-105',
    props.className || '',
  ].join(' ');
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.ariaLabel}
      className={classes}
      style={{
        width: props.size || 56,
        height: props.size || 56,
        background: 'rgba(255,255,255,0.18)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.40), 0 12px 36px -8px rgba(232,160,32,0.45), 0 0 0 1px rgba(255,255,255,0.12)',
      }}
    >
      {props.children}
    </button>
  );
}

// GlassToast: notification chip with optional accent.
function GlassToast(props) {
  var accent = props.accent || 'emerald';
  var dot;
  if (accent === 'pink') dot = '#EF8B8C';
  else if (accent === 'gold') dot = '#E8A020';
  else if (accent === 'teal') dot = '#3D8FA0';
  else dot = '#34D399';
  return (
    <div
      className={'inline-flex items-center gap-2 rounded-full backdrop-blur-xl border border-white/20 px-3 py-1.5 text-xs text-white/85 ' + (props.className || '')}
      style={{
        background: 'rgba(255,255,255,0.12)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
      }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: dot, boxShadow: '0 0 8px ' + dot }} />
      {props.children}
    </div>
  );
}

// RainbowEdge: thin horizontal multicolor band, used as section dividers.
function RainbowEdge(props) {
  return (
    <div
      className={'h-px w-full ' + (props.className || '')}
      style={{
        background: 'linear-gradient(90deg, rgba(239,139,140,0) 0%, rgba(239,139,140,0.6) 22%, rgba(232,160,32,0.6) 45%, rgba(61,143,160,0.6) 68%, rgba(239,11,244,0.5) 86%, rgba(239,139,140,0) 100%)',
        opacity: props.opacity == null ? 0.6 : props.opacity,
      }}
    />
  );
}

export {
  OrbField,
  GlassPanel,
  GlassPill,
  GlassIconButton,
  GlassFAB,
  GlassToast,
  RainbowEdge,
};
