import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Icon } from '../ui';

var SCREEN_TO_ROUTE = {
  home: '/', clash: '/clash', standings: '/standings', leaderboard: '/leaderboard',
  events: '/events', hof: '/hall-of-fame', archive: '/archive', results: '/results',
  milestones: '/milestones', challenges: '/challenges', scrims: '/scrims',
  pricing: '/pricing', sponsors: '/sponsors', account: '/account', admin: '/admin',
  'host-dashboard': '/host/dashboard', ops: '/ops', rules: '/rules', faq: '/faq',
};

export default function Sidebar() {
  var ctx = useApp();
  var navigate = useNavigate();
  var screen = ctx.screen;
  var setScreen = ctx.setScreen;
  var currentUser = ctx.currentUser;
  var isAdmin = ctx.isAdmin;
  var toast = ctx.toast;
  var scrimAccess = ctx.scrimAccess;
  var scrimHostAccess = ctx.scrimHostAccess;
  var setAuthScreen = ctx.setAuthScreen;
  var tournamentState = ctx.tournamentState;

  var canScrims = isAdmin || (currentUser && ((scrimAccess || []).includes(currentUser.username) || (scrimHostAccess || []).includes(currentUser.username)));

  var navTo = useCallback(function(s) {
    var canS = isAdmin || (currentUser && ((scrimAccess || []).includes(currentUser.username) || (scrimHostAccess || []).includes(currentUser.username)));
    if (s === 'scrims' && !canS) { toast('Access restricted', 'error'); return; }
    if (s === 'account' && !currentUser) { setAuthScreen('login'); return; }
    setScreen(s);
    var route = SCREEN_TO_ROUTE[s];
    if (route) navigate(route);
    else navigate('/' + s);
  }, [isAdmin, currentUser, scrimAccess, scrimHostAccess, toast, navigate, setScreen, setAuthScreen]);

  var phase = (tournamentState && tournamentState.phase) || '';

  function NavItem(props) {
    var id = props.id;
    var icon = props.icon;
    var label = props.label;
    var badge = props.badge;
    var isActive = screen === id;
    return (
      <button
        onClick={function() { navTo(id); }}
        className={'flex items-center gap-4 px-6 py-3.5 w-full text-left border-none cursor-pointer transition-all duration-200 font-sans uppercase text-xs font-semibold tracking-widest relative ' +
          (isActive
            ? 'text-primary bg-primary/10 border-r-2 border-primary'
            : 'text-on-surface/40 hover:text-on-surface hover:bg-white/[0.04] bg-transparent')}
      >
        <Icon name={icon} size={20} className={isActive ? 'opacity-100' : 'opacity-60'} />
        <span className="flex-1">{label}</span>
        {badge && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">{badge}</span>
        )}
      </button>
    );
  }

  function Divider() {
    return <div className="h-px bg-white/[0.05] mx-6 my-1.5" />;
  }

  var clashBadge = phase === 'registration' ? 'Register' : phase === 'live' ? 'Live' : phase === 'complete' ? 'Done' : null;

  return (
    <aside className="hidden xl:flex fixed left-0 top-0 h-screen w-64 bg-[#13131A] border-r border-white/[0.05] flex-col z-40 pt-20">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/[0.05]">
        <div className="font-display font-bold text-primary text-base uppercase tracking-tight">TFT Clash</div>
        <div className="font-sans uppercase text-[10px] font-semibold text-on-surface/30 tracking-widest mt-0.5">Elite Competition</div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <NavItem id="home"        icon="home"              label="Dashboard" />
        <NavItem id="clash"       icon="swords"            label="Clash"      badge={clashBadge} />
        <NavItem id="standings"   icon="bar_chart"         label="Standings" />
        <NavItem id="leaderboard" icon="leaderboard"       label="Leaderboard" />
        <NavItem id="events"      icon="calendar_month"    label="Events" />
        <NavItem id="hof"         icon="workspace_premium" label="Hall of Fame" />

        <Divider />

        <NavItem id="archive"    icon="inventory_2"           label="Archive" />
        <NavItem id="results"    icon="assignment_turned_in"  label="Results" />
        <NavItem id="milestones" icon="redeem"                label="Milestones" />
        <NavItem id="challenges" icon="star"                  label="Challenges" />
        {canScrims && <NavItem id="scrims" icon="sports_esports" label="Scrims" />}

        <Divider />

        <NavItem id="pricing" icon="sell"      label="Pricing" />
        <NavItem id="sponsors" icon="handshake" label="Sponsors" />
        <NavItem id="rules"   icon="menu_book" label="Rules" />
        <NavItem id="faq"     icon="help"      label="FAQ" />

        {isAdmin && (
          <>
            <Divider />
            <NavItem id="ops"            icon="radar"             label="Command Center" />
            <NavItem id="admin"          icon="shield"            label="Admin Panel" />
            <NavItem id="host-dashboard" icon="workspace_premium" label="Host Dashboard" />
          </>
        )}
      </nav>

      {/* CTA */}
      <div className="px-5 py-5 border-t border-white/[0.05] shrink-0">
        <button
          onClick={function() { navTo(currentUser ? 'clash' : 'signup'); }}
          className="w-full py-3 rounded-full bg-gradient-to-br from-primary to-[#CC8A28] text-[#07070E] font-sans font-bold uppercase tracking-widest text-sm cursor-pointer border-none active:scale-95 transition-transform shadow-[0_4px_20px_rgba(232,168,56,0.3)]"
        >
          {currentUser ? 'Join Clash' : 'Sign Up Free'}
        </button>
      </div>
    </aside>
  );
}
