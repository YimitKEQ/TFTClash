import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Btn, Inp, Panel, Icon } from '../ui';
import { supabase } from '../../lib/supabase';

var SCREEN_TO_ROUTE = {
  home: '/', login: '/login', signup: '/signup', standings: '/standings',
  leaderboard: '/leaderboard', bracket: '/bracket', profile: '/player',
  results: '/results', events: '/events', scrims: '/scrims', pricing: '/pricing',
  milestones: '/milestones', challenges: '/challenges', hof: '/hall-of-fame',
  archive: '/archive', recap: '/season-recap', rules: '/rules', faq: '/faq',
  account: '/account', 'host-apply': '/host/apply', 'host-dashboard': '/host/dashboard',
  admin: '/admin', ops: '/ops', privacy: '/privacy', terms: '/terms', clash: '/clash',
  tournaments: '/tournaments', gear: '/gear', stats: '/stats'
};

var DESKTOP_LINKS = [
  { id: 'clash',      label: 'Clash' },
  { id: 'standings',  label: 'Standings' },
  { id: 'events',     label: 'Events' },
  { id: 'stats',      label: 'Stats' },
  { id: 'hof',        label: 'Hall of Fame' },
  { id: 'pricing',    label: 'Pricing' },
];

var MOBILE_TABS = [
  { id: 'home',      icon: 'home',        label: 'Home' },
  { id: 'clash',     icon: 'swords',      label: 'Clash' },
  { id: 'standings', icon: 'leaderboard', label: 'Rank' },
  { id: 'account',   icon: 'person',      label: 'Account' },
  { id: '__more__',  icon: 'menu',        label: 'More' },
];

function NotificationBell(props) {
  var notifications = props.notifications;
  var onMarkAllRead = props.onMarkAllRead;
  var _open = useState(false);
  var open = _open[0];
  var setOpen = _open[1];
  var unread = (notifications || []).filter(function(n) { return !n.read; }).length;

  var ICON_MAP = {
    bell: 'notifications', trophy: 'emoji_events', star: 'star',
    swords: 'swords', check: 'check_circle', alert: 'warning',
    info: 'info', calendar: 'calendar_today', gift: 'redeem',
    fire: 'local_fire_department', bolt: 'bolt', person: 'person'
  };

  return (
    <div className="relative">
      <button
        onClick={function() { setOpen(function(o) { return !o; }); }}
        aria-label={unread > 0 ? (unread + ' unread notifications') : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative p-2 text-on-surface/50 hover:text-on-surface transition-colors duration-200 rounded-lg hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon name="notifications" size={22} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-primary flex items-center justify-center text-[7px] font-black text-[#07070E]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[149]" onClick={function() { setOpen(false); }} />
          <div className="absolute right-0 top-[calc(100%+8px)] w-[300px] bg-[#1B1B23] border border-white/10 rounded-xl shadow-[0_20px_56px_rgba(0,0,0,0.7)] z-[150] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex justify-between items-center">
              <span className="text-[13px] font-bold text-on-surface font-label uppercase tracking-widest">Notifications</span>
              {unread > 0 && (
                <button onClick={function() { onMarkAllRead && onMarkAllRead(); }} className="text-primary text-[11px] font-semibold bg-transparent border-none cursor-pointer font-[inherit]">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {(notifications || []).length === 0 ? (
                <div className="py-8 text-center text-on-surface/40 text-[13px]">All caught up!</div>
              ) : (
                (notifications || []).map(function(n) {
                  return (
                    <div key={n.id} className={'px-4 py-3 border-b border-white/[0.04] flex gap-3 items-start' + (n.read ? '' : ' bg-primary/[0.03]')}>
                      <Icon name={ICON_MAP[n.icon] || 'notifications'} size={16} className="mt-0.5 text-on-surface/40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className={'text-xs leading-[1.4] mb-0.5 ' + (n.read ? 'text-on-surface/60' : 'font-semibold text-on-surface')}>{n.title}</div>
                        <div className="text-[11px] text-on-surface/40 leading-relaxed">{n.body}</div>
                      </div>
                      {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Navbar() {
  var ctx = useApp();
  var navigate = useNavigate();
  var screen = ctx.screen;
  var setScreen = ctx.setScreen;
  var players = ctx.players;
  var isAdmin = ctx.isAdmin;
  var setIsAdmin = ctx.setIsAdmin;
  var setAdminOverride = ctx.setAdminOverride;
  var toast = ctx.toast;
  var disputes = ctx.disputes;
  var currentUser = ctx.currentUser;
  var notifications = ctx.notifications;
  var markAllRead = ctx.markAllRead;
  var scrimAccess = ctx.scrimAccess;
  var scrimHostAccess = ctx.scrimHostAccess;
  var tournamentState = ctx.tournamentState;
  var authScreen = ctx.authScreen;
  var setAuthScreen = ctx.setAuthScreen;

  var _drawer = useState(false);
  var drawer = _drawer[0];
  var setDrawer = _drawer[1];

  var _pwModal = useState(false);
  var pwModal = _pwModal[0];
  var setPwModal = _pwModal[1];

  var _pw = useState('');
  var pw = _pw[0];
  var setPw = _pw[1];

  var navTo = useCallback(function(s) {
    var base = s.split('/')[0];
    var canS = isAdmin || (currentUser && ((scrimAccess || []).includes(currentUser.username) || (scrimHostAccess || []).includes(currentUser.username)));
    if (base === 'scrims' && !canS) { toast('Access restricted', 'error'); return; }
    setAuthScreen(null);
    setScreen(base);
    var route = SCREEN_TO_ROUTE[base];
    if (route) navigate(route);
    else navigate('/' + base);
  }, [isAdmin, currentUser, scrimAccess, scrimHostAccess, toast, navigate, setScreen, setAuthScreen]);

  function tryLogin() {
    supabase.auth.getSession().then(function(sess) {
      var token = sess.data && sess.data.session && sess.data.session.access_token;
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      fetch('/api/check-admin', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ password: pw })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data && data.isAdmin) { setAdminOverride(true); setPwModal(false); setPw(''); toast('Admin activated', 'success'); }
        else toast('Wrong password', 'error');
      });
    });
  }

  var phase = tournamentState && tournamentState.phase;
  var dispCount = (disputes || []).length;
  var canScrims = isAdmin || (currentUser && ((scrimAccess || []).includes(currentUser.username) || (scrimHostAccess || []).includes(currentUser.username)));

  var linkedPlayer = currentUser && players && players.find(function(p) {
    if (currentUser.id) {
      if (String(p.id) === String(currentUser.id)) return true;
      if (p.auth_user_id === currentUser.id || p.authUserId === currentUser.id) return true;
    }
    var cuAuth = currentUser.auth_user_id || currentUser.authUserId;
    if (cuAuth && (p.authUserId === cuAuth || p.auth_user_id === cuAuth)) return true;
    var un = (currentUser.username || currentUser.name || '').toLowerCase();
    if (!un) return false;
    return (p.name || '').toLowerCase() === un || (p.username || '').toLowerCase() === un;
  });
  var sid = linkedPlayer ? String(linkedPlayer.id) : null;
  var isRegistered = !!(sid && tournamentState && (tournamentState.registeredIds || []).indexOf(sid) > -1);
  var isCheckedIn = !!(sid && tournamentState && (tournamentState.checkedInIds || []).indexOf(sid) > -1);

  // Drawer sections — 5 buckets: Play, Stats, Community, Account, Help
  var playItems = [
    { id: 'home',   icon: 'home',           label: 'Dashboard' },
    { id: 'clash',  icon: 'swords',         label: 'Clash' },
    { id: 'events', icon: 'calendar_month', label: 'Events' },
  ];
  var statsItems = [
    { id: 'standings',   icon: 'bar_chart',            label: 'Standings' },
    { id: 'leaderboard', icon: 'leaderboard',          label: 'Leaderboard' },
    { id: 'hof',         icon: 'workspace_premium',    label: 'Hall of Fame' },
    { id: 'results',     icon: 'assignment_turned_in', label: 'Results' },
    { id: 'archive',     icon: 'inventory_2',          label: 'Archive' },
  ];
  var communityItems = [
    { id: 'milestones', icon: 'redeem',    label: 'Milestones' },
    { id: 'challenges', icon: 'star',      label: 'Challenges' },
    { id: 'sponsors',   icon: 'handshake', label: 'Sponsors' },
  ];
  if (canScrims) communityItems.push({ id: 'scrims', icon: 'sports_esports', label: 'Scrims' });

  var accountItems = [
    { id: 'account', icon: 'person', label: currentUser ? (currentUser.username || 'My Account') : 'Sign In' },
    { id: 'pricing', icon: 'sell',   label: 'Upgrade' },
  ];
  var helpItems = [
    { id: 'rules', icon: 'menu_book', label: 'Rules' },
    { id: 'faq',   icon: 'help',      label: 'FAQ' },
  ];
  var adminItems = isAdmin ? [
    { id: 'ops',            icon: 'radar',             label: 'Command Center' },
    { id: 'admin',          icon: 'shield',            label: 'Admin Panel' },
    { id: 'host-dashboard', icon: 'workspace_premium', label: 'Host Dashboard' },
  ] : [];

  var rawPic = (linkedPlayer && linkedPlayer.profile_pic_url) || '';
  var navPic = rawPic && rawPic.indexOf('https://') === 0 ? rawPic : '';

  function DrawerSection(props) {
    var items = props.items;
    var label = props.label;
    return (
      <div className="py-1">
        {label && (
          <div className="px-6 pt-2 pb-1">
            <span className="font-label text-[10px] uppercase tracking-[0.22em] font-bold text-on-surface/30">{label}</span>
          </div>
        )}
        {items.map(function(item) {
          var isActive = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={function() {
                if (item.id === 'account' && !currentUser) { setAuthScreen('login'); setDrawer(false); return; }
                navTo(item.id);
                setDrawer(false);
              }}
              className={'flex items-center gap-3.5 py-2.5 px-6 w-full text-left border-none cursor-pointer transition-all duration-150 text-[13px] font-label uppercase tracking-widest font-semibold ' +
                (isActive ? 'bg-primary/10 text-primary' : 'bg-transparent text-on-surface/50 hover:text-on-surface hover:bg-white/[0.04]')}
            >
              <Icon name={item.icon} size={18} className={isActive ? 'opacity-100' : 'opacity-60'} />
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {/* Admin password modal */}
      {pwModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1002] p-4">
          <Panel glow className="w-full max-w-[340px] p-[26px]">
            <h3 className="text-on-surface text-lg mb-4">Admin Access</h3>
            <Inp value={pw} onChange={function(e) { setPw(e && e.target ? e.target.value : e); }}
              type="password" placeholder="Enter password..."
              onKeyDown={function(e) { if (e.key === 'Enter') tryLogin(); }}
              className="mb-3.5" />
            <div className="flex gap-2.5">
              <Btn variant="primary" className="flex-1" onClick={tryLogin}>Login</Btn>
              <Btn variant="ghost" onClick={function() { setPwModal(false); setPw(''); }}>Cancel</Btn>
            </div>
          </Panel>
        </div>
      )}

      {/* Drawer */}
      {drawer && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={function() { setDrawer(false); }} />
          <div className="fixed top-0 right-0 h-full w-72 bg-[#13131A] border-l border-white/[0.06] z-[61] flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 h-20 border-b border-white/[0.06] shrink-0">
              <span className="font-display text-primary text-lg uppercase tracking-tight">Menu</span>
              <button onClick={function() { setDrawer(false); }} className="p-2 text-on-surface/40 hover:text-on-surface bg-transparent border-none cursor-pointer">
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="flex-1 py-2">
              <DrawerSection label="Play" items={playItems} />
              <DrawerSection label="Stats" items={statsItems} />
              <DrawerSection label="Community" items={communityItems} />
              <DrawerSection label="Account" items={accountItems} />
              <DrawerSection label="Help" items={helpItems} />
              {adminItems.length > 0 && (
                <DrawerSection label="Admin" items={adminItems} />
              )}
            </div>
            <div className="p-5 border-t border-white/[0.06] shrink-0">
              {!isAdmin ? (
                <Btn variant="ghost" className="w-full" onClick={function() { setDrawer(false); setPwModal(true); }}>Admin Login</Btn>
              ) : (
                <Btn variant="destructive" className="w-full" onClick={function() { setAdminOverride(false); setDrawer(false); toast('Admin off', 'success'); }}>Exit Admin</Btn>
              )}
            </div>
          </div>
        </>
      )}

      {/* Top header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-20 bg-[#1B1B23]/60 backdrop-blur-xl border-b border-white/5 shadow-[0_40px_40px_rgba(228,225,236,0.04)]">
        <div className="flex items-center justify-between h-full px-6 xl:px-8 max-w-[1920px] mx-auto">

          {/* Logo */}
          <button
            type="button"
            onClick={function() { navTo('home'); }}
            aria-label="TFT Clash home"
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity shrink-0 bg-transparent border-none p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <img src="/icon-border.png" alt="" aria-hidden="true" className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(232,168,56,0.4)]" />
            <span className="font-display font-black italic text-xl text-primary uppercase tracking-tighter leading-none">TFT CLASH</span>
          </button>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {DESKTOP_LINKS.map(function(l) {
              var isLive = l.id === 'clash' && (phase === 'inprogress' || phase === 'live');
              var isActive = screen === l.id;
              var label = l.label;
              if (l.id === 'clash') {
                if (isLive) label = '\u25cf LIVE CLASH';
                else if (phase === 'registration') label = isRegistered ? 'Clash - Joined' : 'Clash - Register';
                else if (phase === 'checkin') label = isCheckedIn ? 'Clash - Checked In' : 'Clash - Check-In';
                else if (phase === 'complete') label = 'Clash - Results';
              }
              return (
                <button
                  key={l.id}
                  onClick={function() { navTo(l.id); }}
                  className={'px-4 py-1.5 border-none cursor-pointer transition-all duration-200 font-label uppercase tracking-widest text-sm font-semibold rounded relative ' +
                    (isLive
                      ? 'text-primary bg-primary/10'
                      : isActive
                        ? 'text-primary'
                        : 'text-on-surface/50 hover:text-on-surface bg-transparent')}
                  style={isActive ? { borderBottom: '2px solid #E8A838' } : {}}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            {dispCount > 0 && (
              <button onClick={function() { navTo('admin'); }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/30 rounded-full cursor-pointer animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                <span className="text-[11px] font-bold text-red-400">{dispCount}</span>
              </button>
            )}

            <NotificationBell notifications={notifications || []} onMarkAllRead={markAllRead} />

            {currentUser ? (
              <button
                onClick={function() { navTo('account'); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 hover:border-primary/40 transition-all duration-200 cursor-pointer"
              >
                {navPic ? (
                  <div className="w-6 h-6 rounded-full bg-cover bg-center shrink-0 border border-primary/30" style={{ backgroundImage: 'url(' + navPic + ')' }} />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Icon name="person" size={14} className="text-primary" />
                  </div>
                )}
                <span className="text-sm font-semibold text-primary font-label uppercase tracking-wide hidden sm:block">{currentUser.username}</span>
              </button>
            ) : (
              <div className="hidden md:flex gap-2">
                <Btn variant="ghost" size="sm" onClick={function() { setAuthScreen('login'); }}>Sign In</Btn>
                <Btn variant="primary" size="sm" onClick={function() { setAuthScreen('signup'); }}>Sign Up</Btn>
              </div>
            )}

            {/* Menu button - all screen sizes */}
            <button
              onClick={function() { setDrawer(true); }}
              aria-label="Open menu"
              aria-haspopup="true"
              aria-expanded={drawer}
              className="p-2 text-on-surface/50 hover:text-on-surface transition-colors rounded-lg hover:bg-white/5 bg-transparent border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Icon name="menu" size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-[#13131A]/95 backdrop-blur-xl border-t border-white/[0.06] flex justify-around items-center pb-[env(safe-area-inset-bottom)]">
        {MOBILE_TABS.map(function(item) {
          var isActive = item.id !== '__more__' && (screen === item.id || (item.id === 'home' && screen === 'home'));
          return (
            <button
              key={item.id}
              onClick={function() {
                if (item.id === '__more__') { setDrawer(true); return; }
                if (item.id === 'account' && !currentUser) { setAuthScreen('login'); return; }
                navTo(item.id);
              }}
              className={'flex flex-col items-center gap-0.5 py-1 px-3 cursor-pointer bg-transparent border-none transition-colors ' +
                (isActive ? 'text-primary' : 'text-on-surface/40')}
            >
              {item.id === '__more__' && drawer ? (
                <Icon name="close" size={22} />
              ) : (
                <Icon name={item.icon} size={22} />
              )}
              <span className="text-[9px] font-label uppercase tracking-widest font-bold">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
