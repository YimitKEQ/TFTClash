import React from 'react';
import BTBoard from './brosephtech/BTBoard';
import BTSchedule from './brosephtech/BTSchedule';
import BTStudio from './brosephtech/BTStudio';
import BTMarketing from './brosephtech/BTMarketing';
import BTMetrics from './brosephtech/BTMetrics';
import BTTierLists from './brosephtech/BTTierLists';
import BTSops from './brosephtech/BTSops';
import {
  OrbField,
  GlassPanel,
  GlassPill,
  GlassIconButton,
  GlassToast,
  RainbowEdge,
} from './brosephtech/BTGlass';

var PIN = '1738';
var SESSION_KEY = 'bt_unlocked';

var TABS = [
  { id: 'board', label: 'Content Board', shortLabel: 'Board', icon: 'view_kanban' },
  { id: 'schedule', label: 'Schedule', shortLabel: 'Plan', icon: 'calendar_month' },
  { id: 'studio', label: 'Studio', shortLabel: 'Studio', icon: 'auto_awesome' },
  { id: 'marketing', label: 'Marketing Lab', shortLabel: 'Mktg', icon: 'campaign' },
  { id: 'tierlists', label: 'Tier Lists', shortLabel: 'Tiers', icon: 'leaderboard' },
  { id: 'metrics', label: 'Metrics', shortLabel: 'Stats', icon: 'trending_up' },
  { id: 'sops', label: 'Production SOPs', shortLabel: 'SOPs', icon: 'menu_book' },
];

// Primary 4 visible in bottom bar, rest accessed via More sheet
var BOTTOM_PRIMARY = ['board', 'schedule', 'studio', 'marketing'];
var BOTTOM_OVERFLOW = ['tierlists', 'metrics', 'sops'];

function BTIcon(props) {
  var style = props.style || {};
  var filled = props.filled ? 'material-symbols-outlined font-filled' : 'material-symbols-outlined';
  return (
    <span className={filled + ' ' + (props.className || '')} style={style}>
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
              <BTIcon name="backspace" className="text-lg" />
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
          <img
            src="/btlogo.png"
            alt="BrosephTech"
            className="w-32 sm:w-36"
            style={{ filter: 'drop-shadow(0 6px 24px rgba(232,160,32,0.45))' }}
          />
          <RainbowEdge className="w-32" opacity={0.7} />
        </div>

        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight" style={{ fontFamily: 'Russo One, sans-serif' }}>
            Command Center
          </h1>
          <p className="text-xs text-white/55 mt-1.5 tracking-wide">Team access only</p>
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

        <p className="text-[11px] text-white/35 tracking-widest uppercase">BrosephTech - Private</p>
      </GlassPanel>

      <style>{'@keyframes bt-wiggle { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }'}</style>
    </div>
  );
}

function MoreSheet(props) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 sm:hidden" onClick={props.onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="absolute bottom-0 inset-x-0 rounded-t-3xl border-t border-white/20 backdrop-blur-2xl pb-safe"
        style={{
          background: 'rgba(13,17,32,0.78)',
          boxShadow: '0 -20px 60px -10px rgba(5,8,20,0.6), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
        onClick={function(e) { e.stopPropagation(); }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-white/25" />
        </div>
        <RainbowEdge className="mx-6 my-2" opacity={0.5} />
        <div className="px-3 pt-2 pb-4 grid grid-cols-3 gap-2">
          {props.items.map(function(t) {
            var active = props.activeTab === t.id;
            var bg = active ? 'rgba(232,160,32,0.22)' : 'rgba(255,255,255,0.06)';
            var border = active ? 'border-[#E8A020]/55' : 'border-white/12';
            var text = active ? 'text-[#FFD487]' : 'text-white/75';
            return (
              <button
                key={t.id}
                onClick={function() { props.onPick(t.id); }}
                className={'flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border backdrop-blur-xl transition-all ' + border + ' ' + text}
                style={{
                  background: bg,
                  boxShadow: active
                    ? 'inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 24px -8px rgba(232,160,32,0.4)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.10)',
                }}
              >
                <BTIcon name={t.icon} className="text-2xl" />
                <span className="text-[11px] font-semibold tracking-wide">{t.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BottomNav(props) {
  var primary = BOTTOM_PRIMARY.map(function(id) {
    return TABS.find(function(t) { return t.id === id; });
  });
  var overflowActive = BOTTOM_OVERFLOW.indexOf(props.activeTab) !== -1;

  return (
    <nav
      className="fixed bottom-3 inset-x-3 z-40 sm:hidden rounded-2xl border border-white/15 backdrop-blur-2xl"
      style={{
        background: 'rgba(13,17,32,0.72)',
        boxShadow: '0 12px 36px -10px rgba(5,8,20,0.7), inset 0 1px 0 rgba(255,255,255,0.18)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="grid grid-cols-5 px-1">
        {primary.map(function(t) {
          var active = props.activeTab === t.id;
          var color = active ? 'text-[#FFD487]' : 'text-white/55 active:text-white';
          return (
            <button
              key={t.id}
              onClick={function() { props.onPick(t.id); }}
              className={'relative flex flex-col items-center justify-center gap-0.5 py-2 transition-all ' + color}
            >
              {active ? (
                <span
                  className="absolute inset-1 rounded-xl"
                  style={{
                    background: 'rgba(232,160,32,0.18)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20)',
                  }}
                />
              ) : null}
              <BTIcon name={t.icon} className="relative text-[22px]" />
              <span className="relative text-[10px] font-semibold tracking-wide">{t.shortLabel}</span>
            </button>
          );
        })}
        <button
          onClick={props.onMore}
          className={'relative flex flex-col items-center justify-center gap-0.5 py-2 transition-all ' + (overflowActive ? 'text-[#FFD487]' : 'text-white/55 active:text-white')}
        >
          {overflowActive ? (
            <span
              className="absolute inset-1 rounded-xl"
              style={{
                background: 'rgba(232,160,32,0.18)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20)',
              }}
            />
          ) : null}
          <BTIcon name="more_horiz" className="relative text-[22px]" />
          <span className="relative text-[10px] font-semibold tracking-wide">More</span>
        </button>
      </div>
    </nav>
  );
}

function BrosephTechScreen() {
  var [unlocked, setUnlocked] = React.useState(function() {
    return localStorage.getItem(SESSION_KEY) === '1';
  });
  var [tab, setTab] = React.useState('board');
  var [fade, setFade] = React.useState(false);
  var [moreOpen, setMoreOpen] = React.useState(false);

  function handleUnlock() {
    setUnlocked(true);
  }

  function handleLock() {
    localStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
  }

  function switchTab(t) {
    setMoreOpen(false);
    if (t === tab) return;
    setFade(true);
    setTimeout(function() {
      setTab(t);
      setFade(false);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    }, 120);
  }

  if (!unlocked) {
    return <PinGate onUnlock={handleUnlock} />;
  }

  var overflowItems = BOTTOM_OVERFLOW.map(function(id) {
    return TABS.find(function(t) { return t.id === id; });
  });

  return (
    <div className="min-h-screen relative text-white overflow-hidden">
      <OrbField />

      {/* Header */}
      <div
        className="sticky top-0 z-40 backdrop-blur-2xl border-b border-white/12"
        style={{
          background: 'rgba(8,11,22,0.62)',
          boxShadow: '0 8px 24px -10px rgba(5,8,20,0.6), inset 0 1px 0 rgba(255,255,255,0.10)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <img src="/btlogo.png" alt="BrosephTech" className="h-7 sm:h-9 shrink-0" style={{ filter: 'drop-shadow(0 4px 14px rgba(232,160,32,0.45))' }} />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white leading-none tracking-tight truncate" style={{ fontFamily: 'Russo One, sans-serif' }}>
                BROSEPHTECH
              </h1>
              <p className="text-[10px] sm:text-xs text-[#FFD487] leading-none mt-1 tracking-wider font-semibold">COMMAND CENTER</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:block">
              <GlassToast accent="emerald">Live</GlassToast>
            </div>
            <GlassPill onClick={handleLock} variant="ghost" size="sm" className="!gap-1">
              <BTIcon name="lock" className="text-base" />
              <span className="hidden sm:inline">Lock</span>
            </GlassPill>
          </div>
        </div>
        <div className="hidden sm:flex max-w-7xl mx-auto px-6 pb-3 gap-2 overflow-x-auto">
          {TABS.map(function(t) {
            var active = tab === t.id;
            return (
              <GlassPill
                key={t.id}
                onClick={function() { switchTab(t.id); }}
                variant={active ? 'gold' : 'ghost'}
                className="whitespace-nowrap"
              >
                <BTIcon name={t.icon} className="text-base" />
                {t.label}
              </GlassPill>
            );
          })}
        </div>
        <RainbowEdge opacity={0.55} />
        {/* Mobile current-tab pill */}
        <div className="sm:hidden px-4 pb-3 pt-1 flex items-center gap-2">
          <BTIcon name={(TABS.find(function(t) { return t.id === tab; }) || {}).icon} className="text-[#FFD487] text-base" />
          <span className="text-xs font-bold text-[#FFD487] tracking-wider uppercase">
            {(TABS.find(function(t) { return t.id === tab; }) || {}).label}
          </span>
        </div>
      </div>

      <div
        className={'relative max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 pb-28 sm:pb-8 transition-opacity duration-100 ' + (fade ? 'opacity-0' : 'opacity-100')}
      >
        {tab === 'board' && <BTBoard />}
        {tab === 'schedule' && <BTSchedule />}
        {tab === 'studio' && <BTStudio />}
        {tab === 'marketing' && <BTMarketing />}
        {tab === 'tierlists' && <BTTierLists />}
        {tab === 'metrics' && <BTMetrics />}
        {tab === 'sops' && <BTSops />}
      </div>

      <BottomNav activeTab={tab} onPick={switchTab} onMore={function() { setMoreOpen(true); }} />
      <MoreSheet open={moreOpen} activeTab={tab} items={overflowItems} onPick={switchTab} onClose={function() { setMoreOpen(false); }} />
    </div>
  );
}

export default BrosephTechScreen;
