import React from 'react';
import BTBoard from './brosephtech/BTBoard';
import BTMetrics from './brosephtech/BTMetrics';
import BTSops from './brosephtech/BTSops';

var PIN = '1738';
var SESSION_KEY = 'bt_unlocked';

var TABS = [
  { id: 'board', label: 'Content Board', icon: 'view_kanban' },
  { id: 'metrics', label: 'Metrics', icon: 'trending_up' },
  { id: 'sops', label: 'Production SOPs', icon: 'menu_book' },
];

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
    <div className="grid grid-cols-3 gap-2 w-56 mt-2">
      {keys.map(function(k, i) {
        if (k === '') return <div key={'empty-' + i} />;
        if (k === 'back') {
          return (
            <button
              key={'back'}
              type="button"
              onClick={props.onBackspace}
              className="h-12 rounded-xl bg-[#13172a] border border-white/5 text-white/60 hover:text-[#E8A020] hover:border-[#E8A020]/40 transition-all flex items-center justify-center"
            >
              <BTIcon name="backspace" className="text-lg" />
            </button>
          );
        }
        return (
          <button
            key={k}
            type="button"
            onClick={function() { props.onPress(k); }}
            className="h-12 rounded-xl bg-[#13172a] border border-white/5 text-white font-semibold hover:bg-[#1a1f36] hover:border-[#5BA3DB]/40 transition-all"
          >
            {k}
          </button>
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
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 overflow-hidden relative"
      style={{ background: 'radial-gradient(ellipse at top, #1a1f36 0%, #0b0e1a 55%), #0b0e1a' }}
    >
      {/* Backdrop glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(91,163,219,0.15), transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative flex flex-col items-center">
        <img
          src="/btlogo.png"
          alt="BrosephTech"
          className={'w-36 transition-transform ' + (shake ? 'animate-[wiggle_0.5s]' : '')}
          style={{ filter: 'drop-shadow(0 4px 20px rgba(91,163,219,0.25))' }}
        />
      </div>

      <div className="text-center relative">
        <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: 'Russo One, sans-serif' }}>
          Command Center
        </h1>
        <p className="text-sm text-white/40 mt-1.5 tracking-wide">Team access only</p>
      </div>

      <div className={'flex gap-3 relative ' + (shake ? 'animate-[wiggle_0.5s]' : '')}>
        {[0,1,2,3].map(function(i) {
          var filled = input.length > i;
          var err = error;
          return (
            <div
              key={i}
              className={'w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ' + (err ? 'border-2 border-red-500 text-red-400' : filled ? 'border-2 border-[#5BA3DB] text-[#5BA3DB] bg-[#5BA3DB]/5' : 'border border-white/10 text-white/20')}
            >
              {filled ? 'o' : ''}
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="text-red-400 text-sm font-medium">Wrong PIN</p>
      ) : (
        <p className="text-white/30 text-xs">Enter 4-digit PIN</p>
      )}

      <PinKeypad onPress={handleKeyPress} onBackspace={handleBackspace} />

      <p className="absolute bottom-6 text-[11px] text-white/20 tracking-widest uppercase">BrosephTech - Private</p>

      <style>{'@keyframes wiggle { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }'}</style>
    </div>
  );
}

function BrosephTechScreen() {
  var [unlocked, setUnlocked] = React.useState(function() {
    return localStorage.getItem(SESSION_KEY) === '1';
  });
  var [tab, setTab] = React.useState('board');
  var [fade, setFade] = React.useState(false);

  function handleUnlock() {
    setUnlocked(true);
  }

  function handleLock() {
    localStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
  }

  function switchTab(t) {
    if (t === tab) return;
    setFade(true);
    setTimeout(function() {
      setTab(t);
      setFade(false);
    }, 120);
  }

  if (!unlocked) {
    return <PinGate onUnlock={handleUnlock} />;
  }

  return (
    <div className="min-h-screen bg-[#0b0e1a] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0d1120] sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/btlogo.png" alt="BrosephTech" className="h-9" style={{ filter: 'drop-shadow(0 2px 8px rgba(91,163,219,0.3))' }} />
            <div>
              <h1 className="text-lg font-bold text-white leading-none tracking-tight" style={{ fontFamily: 'Russo One, sans-serif' }}>
                BROSEPHTECH
              </h1>
              <p className="text-xs text-[#E8A020] leading-none mt-1 tracking-wider font-semibold">COMMAND CENTER</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
            <button
              onClick={handleLock}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            >
              <BTIcon name="lock" className="text-base" />
              Lock
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 flex gap-0.5 overflow-x-auto">
          {TABS.map(function(t) {
            var active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={function() { switchTab(t.id); }}
                className={'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ' + (active ? 'border-[#E8A020] text-[#E8A020]' : 'border-transparent text-white/40 hover:text-white/80 hover:border-white/10')}
              >
                <BTIcon name={t.icon} className="text-lg" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={'max-w-7xl mx-auto px-6 py-8 transition-opacity duration-100 ' + (fade ? 'opacity-0' : 'opacity-100')}
      >
        {tab === 'board' && <BTBoard />}
        {tab === 'metrics' && <BTMetrics />}
        {tab === 'sops' && <BTSops />}
      </div>
    </div>
  );
}

export default BrosephTechScreen;
