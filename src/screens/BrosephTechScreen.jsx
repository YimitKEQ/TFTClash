import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/layout/PageLayout';
import { Icon, Btn, PillTab, PillTabGroup } from '../components/ui';
import BTBoard from './brosephtech/BTBoard';
import BTSchedule from './brosephtech/BTSchedule';
import BTStudio from './brosephtech/BTStudio';
import BTMarketing from './brosephtech/BTMarketing';
import BTMetrics from './brosephtech/BTMetrics';
import BTTierLists from './brosephtech/BTTierLists';
import BTSops from './brosephtech/BTSops';

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
      try { localStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
      setTimeout(function() { props.onUnlock(); }, 150);
    } else {
      setError(true); setShake(true);
      setTimeout(function() {
        setShake(false); setInput(''); setError(false);
        bufferRef.current = ''; lockedRef.current = false;
      }, 700);
    }
  }

  function handleKeyPress(k) {
    if (lockedRef.current) return;
    if (bufferRef.current.length >= 4) return;
    var next = bufferRef.current + k;
    bufferRef.current = next; setInput(next); setError(false);
    tryUnlock(next);
  }

  function handleBackspace() {
    if (lockedRef.current) return;
    bufferRef.current = bufferRef.current.slice(0, -1);
    setInput(bufferRef.current); setError(false);
  }

  React.useEffect(function() {
    function onKey(e) {
      if (e.key >= '0' && e.key <= '9') handleKeyPress(e.key);
      else if (e.key === 'Backspace') handleBackspace();
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, []);

  var keys = ['1','2','3','4','5','6','7','8','9','','0','back'];

  return (
    <PageLayout>
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
        <div className={'w-full max-w-sm bg-surface-container-low border border-outline-variant/15 rounded p-6 sm:p-8 flex flex-col items-center gap-5 ' + (shake ? 'animate-[bt-wiggle_0.5s]' : '')}>
          <div className="flex flex-col items-center gap-2">
            <Icon name="lock" size={28} className="text-primary" />
            <div className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface/40">
              OPERATOR ACCESS
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
              BrosephTech
            </h1>
          </div>

          <div className="flex gap-2">
            {[0,1,2,3].map(function(idx) {
              var filled = input.length > idx;
              var stateClass = error
                ? 'border-error/60 text-error'
                : filled
                  ? 'border-primary/60 text-primary'
                  : 'border-outline-variant/20 text-on-surface/30';
              return (
                <div
                  key={idx}
                  className={'w-10 h-12 rounded bg-surface-container border flex items-center justify-center text-lg font-mono font-bold ' + stateClass}
                >
                  {filled ? '\u2022' : ''}
                </div>
              );
            })}
          </div>

          {error ? (
            <p className="text-error text-xs font-label uppercase tracking-wider">Wrong PIN</p>
          ) : (
            <p className="text-on-surface/40 text-[11px] font-label uppercase tracking-wider">Enter 4-digit PIN</p>
          )}

          <div className="grid grid-cols-3 gap-2 w-full max-w-[260px]">
            {keys.map(function(k, i) {
              if (k === '') return <div key={'empty-' + i} />;
              if (k === 'back') {
                return (
                  <button
                    key="back"
                    type="button"
                    onClick={handleBackspace}
                    className="h-12 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/15 text-on-surface/70 flex items-center justify-center transition-colors"
                  >
                    <Icon name="backspace" size={18} />
                  </button>
                );
              }
              return (
                <button
                  key={k}
                  type="button"
                  onClick={function() { handleKeyPress(k); }}
                  className="h-12 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/15 text-on-surface font-mono text-base font-bold transition-colors"
                >
                  {k}
                </button>
              );
            })}
          </div>
        </div>
        <style>{'@keyframes bt-wiggle { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }'}</style>
      </div>
    </PageLayout>
  );
}

function BrosephTechScreen() {
  var navigate = useNavigate();
  var [unlocked, setUnlocked] = React.useState(function() {
    try { return localStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  });
  var [tab, setTab] = React.useState('board');

  function handleUnlock() { setUnlocked(true); }
  function handleLock() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    setUnlocked(false);
  }

  if (!unlocked) {
    return <PinGate onUnlock={handleUnlock} />;
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5 pb-24 sm:pb-8">
        {/* OPS-STYLE HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icon name="auto_awesome" size={32} className="text-primary" />
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success animate-pulse border-2 border-[#13131A]" />
            </div>
            <div>
              <h1 className="font-editorial text-2xl font-bold text-on-surface tracking-tight">BrosephTech</h1>
              <div className="font-label text-[10px] text-on-surface/30 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span>Creator command center</span>
                <button
                  type="button"
                  onClick={function() { navigate('/tfttech'); }}
                  className="text-on-surface/30 hover:text-primary transition-colors"
                >
                  / Back to TFTTech
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn v="dark" s="sm" onClick={handleLock}>
              <Icon name="lock" size={14} /> Lock
            </Btn>
          </div>
        </div>

        {/* TABS */}
        <PillTabGroup align="start">
          {TABS.map(function(t) {
            return (
              <PillTab
                key={t.id}
                icon={t.icon}
                active={tab === t.id}
                onClick={function() { setTab(t.id); }}
              >
                {t.label}
              </PillTab>
            );
          })}
        </PillTabGroup>

        {/* TAB CONTENT */}
        <div>
          {tab === 'board' && <BTBoard />}
          {tab === 'schedule' && <BTSchedule />}
          {tab === 'studio' && <BTStudio />}
          {tab === 'marketing' && <BTMarketing />}
          {tab === 'tierlists' && <BTTierLists />}
          {tab === 'metrics' && <BTMetrics />}
          {tab === 'sops' && <BTSops />}
        </div>
      </div>
    </PageLayout>
  );
}

export default BrosephTechScreen;
