import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Icon, Btn } from '../ui';
import OnlineCount from '../shared/OnlineCount';
import { DISCORD_URL } from '../../lib/constants';

var SCREEN_TO_ROUTE = {
  home: '/', login: '/login', signup: '/signup',
  clash: '/clash', standings: '/standings', leaderboard: '/leaderboard',
  events: '/events', hof: '/hall-of-fame', archive: '/archive', results: '/results',
  milestones: '/milestones', challenges: '/challenges', scrims: '/scrims',
  pricing: '/pricing', sponsors: '/sponsors', account: '/account', admin: '/admin',
  marketplace: '/marketplace', roadmap: '/roadmap', predictions: '/predictions',
  'host-apply': '/host/apply', 'host-dashboard': '/host/dashboard',
  ops: '/ops', rules: '/rules', faq: '/faq', stats: '/stats',
  bracket: '/bracket', profile: '/player', recap: '/season-recap',
  privacy: '/privacy', terms: '/terms', gear: '/gear', tournaments: '/tournaments'
};

function SectionHeading(props) {
  return (
    <div className="px-6 pt-4 pb-1.5">
      <span className="font-label text-[10px] uppercase tracking-[0.22em] font-bold text-on-surface/30">
        {props.label}
      </span>
    </div>
  );
}

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
  var players = ctx.players || [];

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

  var linkedPlayer = currentUser && players.find(function(p) {
    // currentUser.id may be the player id (from get_my_player) OR the auth uuid
    // (from mapUser fallback). Try both mappings.
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
  var isRegistered = sid && (tournamentState && (tournamentState.registeredIds || []).indexOf(sid) > -1);
  var isCheckedIn = sid && (tournamentState && (tournamentState.checkedInIds || []).indexOf(sid) > -1);

  function NavItem(props) {
    var id = props.id;
    var icon = props.icon;
    var label = props.label;
    var badge = props.badge;
    var isActive = screen === id;
    return (
      <button
        onClick={function() { navTo(id); }}
        className={'flex items-center gap-4 px-6 py-3.5 w-full text-left border-none cursor-pointer transition-all duration-200 font-label uppercase text-xs font-semibold tracking-widest relative ' +
          (isActive
            ? 'text-primary bg-primary/10 border-r-2 border-primary'
            : 'text-on-surface/40 hover:text-on-surface hover:bg-white/[0.04] bg-transparent')}
      >
        <Icon name={icon} size={20} className={isActive ? 'opacity-100' : 'opacity-60'} />
        <span className="flex-1">{label}</span>
        {badge && (
          <span className={"text-[9px] font-bold px-1.5 py-0.5 rounded " + (badge === 'Live' ? "bg-success/20 text-success animate-pulse" : badge === 'Register' ? "bg-secondary/20 text-secondary" : badge === 'Joined' || badge === 'Checked In' ? "bg-tertiary/20 text-tertiary" : "bg-tertiary/20 text-tertiary")}>{badge}</span>
        )}
      </button>
    );
  }

  var clashBadge = null;
  if (phase === 'registration') clashBadge = isRegistered ? 'Joined' : 'Register';
  else if (phase === 'checkin') clashBadge = isCheckedIn ? 'Checked In' : 'Check-In';
  else if (phase === 'live' || phase === 'inprogress') clashBadge = 'Live';
  else if (phase === 'complete') clashBadge = 'Done';

  return (
    <aside className="hidden xl:flex fixed left-0 top-0 h-screen w-64 bg-[#13131A] border-r border-white/[0.05] flex-col z-40 pt-20">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/[0.05]">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-primary text-base uppercase tracking-tight">TFT Clash</div>
            <div className="font-label uppercase text-[10px] font-semibold text-on-surface/30 tracking-widest mt-0.5">Elite Competition</div>
          </div>
          <OnlineCount label="online" />
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <SectionHeading label="Play" />
        <NavItem id="home"   icon="home"           label="Dashboard" />
        <NavItem id="clash"  icon="swords"         label="Clash" badge={clashBadge} />
        <NavItem id="events" icon="calendar_month" label="Events" />

        <SectionHeading label="Stats" />
        <NavItem id="standings"   icon="bar_chart"             label="Standings" />
        <NavItem id="leaderboard" icon="leaderboard"           label="Leaderboard" />
        <NavItem id="hof"         icon="workspace_premium"     label="Hall of Fame" />
        <NavItem id="results"     icon="assignment_turned_in"  label="Results" />
        <NavItem id="archive"     icon="inventory_2"           label="Archive" />

        <SectionHeading label="Community" />
        <NavItem id="milestones"  icon="redeem"     label="Milestones" />
        <NavItem id="challenges"  icon="star"       label="Challenges" />
        <NavItem id="sponsors"    icon="handshake"  label="Sponsors" />
        <NavItem id="marketplace" icon="storefront" label="Marketplace" />
        <NavItem id="roadmap"     icon="route"      label="Roadmap" />
        <NavItem id="predictions" icon="psychology" label="My Picks" />
        {canScrims && <NavItem id="scrims" icon="sports_esports" label="Scrims" />}

        <SectionHeading label="Account" />
        <NavItem id="account" icon="person" label={currentUser ? 'My Account' : 'Sign In'} />
        <NavItem id="pricing" icon="sell"   label="Upgrade" />

        <SectionHeading label="Help" />
        <NavItem id="rules" icon="menu_book" label="Rules" />
        <NavItem id="faq"   icon="help"      label="FAQ" />

        {isAdmin && (
          <>
            <SectionHeading label="Admin" />
            <NavItem id="ops"            icon="radar"             label="Command Center" />
            <NavItem id="admin"          icon="shield"            label="Admin Panel" />
            <NavItem id="host-dashboard" icon="workspace_premium" label="Host Dashboard" />
          </>
        )}
      </nav>

      {/* CTA */}
      <div className="px-5 py-5 border-t border-white/[0.05] shrink-0 space-y-2">
        <Btn
          variant="primary"
          size="md"
          onClick={function() { navTo(currentUser ? 'clash' : 'signup'); }}
          className="w-full"
        >
          {currentUser ? 'Join Clash' : 'Sign Up Free'}
        </Btn>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 rounded-full bg-[#5865F2]/15 hover:bg-[#5865F2]/25 text-[#A8B0F8] font-label font-bold uppercase tracking-widest text-xs border border-[#5865F2]/30 flex items-center justify-center gap-2 transition-colors"
        >
          <Icon name="forum" size={16} />
          Join Discord
        </a>
      </div>
    </aside>
  );
}
