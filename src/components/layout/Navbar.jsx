import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Panel, Btn, Inp, Icon } from '../ui';

// Screen-to-route mapping (mirrors TFTClash.navTo in App.jsx)
var SCREEN_TO_ROUTE = {
  home: "/", login: "/login", signup: "/signup", standings: "/standings",
  leaderboard: "/leaderboard", bracket: "/bracket", profile: "/player",
  results: "/results", events: "/events", scrims: "/scrims", pricing: "/pricing",
  milestones: "/milestones", challenges: "/challenges", hof: "/hall-of-fame",
  archive: "/archive", recap: "/season-recap", rules: "/rules", faq: "/faq",
  account: "/account", "host-apply": "/host/apply", "host-dashboard": "/host/dashboard",
  admin: "/admin", privacy: "/privacy", terms: "/terms", clash: "/clash",
  tournaments: "/tournaments", roster: "/roster", featured: "/featured", gear: "/gear"
};

// Material Symbols name mapping for drawer items
var DRAWER_ICON_MAP = {
  "house-fill": "home",
  "people-fill": "groups",
  "diagram-3-fill": "account_tree",
  "bar-chart-line-fill": "leaderboard",
  "clipboard-check-fill": "assignment_turned_in",
  "award-fill": "emoji_events",
  "controller": "sports_esports",
  "hexagon-fill": "hexagon",
  "archive-fill": "inventory_2",
  "lightning-charge-fill": "bolt",
  "star-fill": "star",
  "gift-fill": "redeem",
  "journal-text": "menu_book",
  "question-circle-fill": "help",
  "tag-fill": "sell",
  "person-fill": "person"
};

// Material Symbols for "More" dropdown items
var MORE_ICON_MAP = {
  "swords": "swords",
  "diamond": "diamond",
  "book": "menu_book",
  "help-circle": "help",
  "crown": "workspace_premium",
  "shopping-bag": "shopping_bag",
  "shield": "shield"
};

function NotificationBell(props) {
  var notifications = props.notifications;
  var onMarkAllRead = props.onMarkAllRead;
  var _open = useState(false);
  var open = _open[0];
  var setOpen = _open[1];

  var unread = notifications.filter(function(n) { return !n.read; }).length;

  // Notification icon mapping
  var NOTIF_ICON_MAP = {
    "bell": "notifications",
    "trophy": "emoji_events",
    "star": "star",
    "swords": "swords",
    "check": "check_circle",
    "alert": "warning",
    "info": "info",
    "calendar": "calendar_today",
    "gift": "redeem",
    "fire": "local_fire_department",
    "bolt": "bolt",
    "shield": "shield",
    "person": "person",
    "chart": "bar_chart"
  };

  function getNotifIcon(iconName) {
    if (!iconName) return "notifications";
    return NOTIF_ICON_MAP[iconName] || "notifications";
  }

  return (
    <div className="relative">
      <button
        onClick={function() { setOpen(function(o) { return !o; }); }}
        className="relative bg-transparent border-none p-1.5 cursor-pointer text-[#C8D4E0] hover:text-[#E8A838] transition-colors duration-150 flex items-center justify-center rounded-lg"
      >
        <Icon name="notifications" size={18} />
        {unread > 0 && (
          <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#E8A838] flex items-center justify-center text-[8px] font-black text-[#07070E] leading-none">
            {unread > 9 ? "9+" : unread}
          </div>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[149]" onClick={function() { setOpen(false); }} />
          <div className="absolute right-0 top-[calc(100%+8px)] w-[300px] bg-gradient-to-br from-[#0F1828] to-[#0B1220] border border-[rgba(232,168,56,0.2)] rounded-[14px] shadow-[0_20px_56px_rgba(0,0,0,0.7)] z-[150] overflow-hidden">

            <div className="px-3.5 py-3 border-b border-[rgba(242,237,228,0.07)] flex justify-between items-center bg-[rgba(232,168,56,0.04)]">
              <div className="flex items-center gap-[7px]">
                <span className="text-[13px] font-bold text-[#F2EDE4]">Notifications</span>
                {unread > 0 && (
                  <span className="bg-[#E8A838] text-[#07070E] text-[9px] font-extrabold rounded-full px-[7px] py-[2px]">
                    {unread} new
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={function() { onMarkAllRead(); }}
                  className="bg-transparent border-none cursor-pointer text-[#9B72CF] text-[11px] font-semibold font-[inherit]"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-7 px-3.5 text-center text-[#9AAABF] text-[13px]">All caught up!</div>
              ) : (
                notifications.map(function(n) {
                  return (
                    <div
                      key={n.id}
                      className={"px-3.5 py-3 border-b border-[rgba(242,237,228,0.05)] flex gap-2.5 items-start" + (n.read ? "" : " bg-[rgba(232,168,56,0.03)]")}
                    >
                      <div className="shrink-0 mt-0.5">
                        <Icon name={getNotifIcon(n.icon)} size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={"text-xs leading-[1.4] mb-0.5 " + (n.read ? "font-normal text-[#C8D4E0]" : "font-semibold text-[#F2EDE4]")}>
                          {n.title}
                        </div>
                        <div className="text-[11px] text-[#BECBD9] leading-[1.5]">{n.body}</div>
                        <div className="text-[10px] text-[#9AAABF] mt-1">{n.time}</div>
                      </div>
                      {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#E8A838] shrink-0 mt-[5px]" />
                      )}
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
  var toast = ctx.toast;
  var disputes = ctx.disputes;
  var currentUser = ctx.currentUser;
  var notifications = ctx.notifications;
  var markAllRead = ctx.markAllRead;
  var scrimAccess = ctx.scrimAccess;
  var tournamentState = ctx.tournamentState;
  var authScreen = ctx.authScreen;
  var setAuthScreen = ctx.setAuthScreen;

  var _pwModal = useState(false);
  var pwModal = _pwModal[0];
  var setPwModal = _pwModal[1];

  var _pw = useState("");
  var pw = _pw[0];
  var setPw = _pw[1];

  var _drawer = useState(false);
  var drawer = _drawer[0];
  var setDrawer = _drawer[1];

  var dispCount = (disputes || []).length;
  var canScrims = isAdmin || (currentUser && (scrimAccess || []).includes(currentUser.username));

  // Navigation helper - mirrors navTo from TFTClash
  var navTo = useCallback(function(s, sub) {
    var parts = s.split("/");
    var base = parts[0];
    var sr = sub || parts[1] || "";
    if (base === "admin" && !isAdmin) { toast("Admin access required", "error"); return; }
    var canS = isAdmin || (currentUser && (scrimAccess || []).includes(currentUser.username));
    if (base === "scrims" && !canS) { toast("Access restricted", "error"); return; }
    setScreen(base);
    var route = SCREEN_TO_ROUTE[base];
    if (route) {
      var fullRoute = sr ? route + "/" + sr : route;
      navigate(fullRoute);
    } else if (base.indexOf("flash-") === 0) {
      navigate("/flash/" + base.replace("flash-", ""));
    } else if (base.indexOf("tournament-") === 0) {
      navigate("/tournament/" + base.replace("tournament-", ""));
    } else {
      navigate("/" + base + (sr ? "/" + sr : ""));
    }
  }, [isAdmin, currentUser, scrimAccess, toast, navigate, setScreen]);

  function tryLogin() {
    fetch('/api/check-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    }).then(function(res) {
      return res.json();
    }).then(function(data) {
      if (data && data.isAdmin) {
        setIsAdmin(true);
        setPwModal(false);
        setPw("");
        toast("Admin mode activated", "success");
      } else {
        toast("Wrong password", "error");
      }
    });
  }

  // Tournament phase
  var phase = tournamentState && tournamentState.phase;

  // Clash nav item with phase-aware badges
  var clashItem = null;
  if (phase === "registration") clashItem = { id: "clash", label: "Clash", badge: "Register", badgeColor: "#E8A838" };
  else if (phase === "live") clashItem = { id: "clash", label: "LIVE", glow: true };
  else if (phase === "complete") clashItem = { id: "clash", label: "Clash", badge: "Results", badgeColor: "#4ECDC4" };

  // Mobile bottom bar items (5 items)
  var PRIMARY = [
    clashItem ? Object.assign({}, clashItem, { icon: "swords" }) : { id: "clash", icon: "swords", label: "Clash" },
    { id: "standings", icon: "bar_chart", label: "Standings" },
    { id: "hof", icon: "emoji_events", label: "HoF" },
    { id: "pricing", icon: "sell", label: "Pricing" },
    { id: "more", icon: "more_horiz", label: "More" }
  ].filter(Boolean);

  // Desktop primary links
  var DESKTOP_PRIMARY = [
    clashItem ? {
      id: "clash",
      label: phase === "live" ? "\u25cf LIVE CLASH" : phase === "registration" ? "Clash - Register" : phase === "complete" ? "Clash - Results" : "Clash"
    } : { id: "clash", label: "Clash" },
    { id: "standings", label: "Standings" },
    { id: "hof", label: "Hall of Fame" },
    { id: "pricing", label: "Pricing" }
  ].filter(Boolean);

  // Profile completion indicator
  var navProfileFields = currentUser ? [
    currentUser.user_metadata && currentUser.user_metadata.riot_id,
    currentUser.user_metadata && currentUser.user_metadata.bio,
    currentUser.user_metadata && currentUser.user_metadata.region
  ] : [];
  var navProfileComplete = navProfileFields.filter(Boolean).length;
  var navProfileTotal = 3;

  // Drawer items
  var communityItems = [
    { id: "archive", icon: "inventory_2", label: "Archive", section: "community" },
    { id: "results", icon: "assignment_turned_in", label: "Results", section: "community" },
    { id: "milestones", icon: "redeem", label: "Milestones", section: "community" },
    { id: "challenges", icon: "star", label: "Challenges", section: "community" }
  ];

  if (canScrims) {
    communityItems = communityItems.concat([
      { id: "scrims", icon: "sports_esports", label: "Scrims", section: "community" }
    ]);
  }

  var adminItems = isAdmin ? [
    { id: "admin", icon: "shield", label: "Admin Panel", section: "admin" },
    { id: "host-dashboard", icon: "workspace_premium", label: "Host Dashboard", section: "admin" }
  ] : [];

  var DRAWER_ITEMS = [
    { id: "clash", icon: "swords", label: "Clash", section: "main" },
    { id: "standings", icon: "bar_chart", label: "Standings", section: "main" },
    { id: "leaderboard", icon: "leaderboard", label: "Leaderboard", section: "main" },
    { id: "hof", icon: "emoji_events", label: "Hall of Fame", section: "main" }
  ].concat(communityItems).concat([
    { id: "account", icon: "person", label: currentUser ? ("Account - " + currentUser.username) : "Sign In / Sign Up", section: "account" },
    { id: "pricing", icon: "sell", label: "Pricing", section: "account" },
    { id: "rules", icon: "menu_book", label: "Rules", section: "account" },
    { id: "faq", icon: "help", label: "FAQ", section: "account" }
  ]).concat(adminItems);

  return (
    <>
      {/* Admin password modal */}
      {pwModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1002] p-4">
          <Panel glow className="w-full max-w-[340px] p-[26px]">
            <div className="mt-1.5">
              <h3 className="text-[#F2EDE4] text-lg mb-1">Admin Access</h3>
              <div className="text-[13px] text-[#BECBD9] mb-4">
                Hint: <span className="text-[#E8A838] font-semibold">admin</span>
              </div>
              <Inp
                value={pw}
                onChange={function(e) { setPw(e && e.target ? e.target.value : e); }}
                type="password"
                placeholder="Enter password..."
                onKeyDown={function(e) { if (e.key === "Enter") tryLogin(); }}
                className="mb-3.5"
              />
              <div className="flex gap-2.5">
                <Btn variant="primary" className="flex-1" onClick={tryLogin}>Login</Btn>
                <Btn variant="ghost" onClick={function() { setPwModal(false); setPw(""); }}>Cancel</Btn>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Drawer overlay + drawer */}
      {drawer && (
        <>
          <div className="drawer-overlay" onClick={function() { setDrawer(false); }} />
          <div className="drawer">
            <div className="px-5 pb-5 border-b border-[rgba(242,237,228,0.08)] mb-4 flex items-center gap-2.5">
              <img
                src="/icon-border.png"
                alt="TFT Clash"
                className="w-9 h-9 object-contain drop-shadow-[0_0_10px_rgba(155,114,207,0.55)]"
              />
              <div>
                <div className="font-display text-base font-bold text-primary">TFT Clash</div>
                <div className="text-xs text-[#BECBD9]">Season 1</div>
              </div>
            </div>

            {(function() {
              var lastSection = "";
              return DRAWER_ITEMS.map(function(l) {
                var divider = l.section !== lastSection && lastSection !== ""
                  ? <div key={"div-" + l.section} className="h-px bg-[rgba(242,237,228,0.06)] mx-4 my-2" />
                  : null;
                lastSection = l.section;
                var isActive = screen === l.id;
                return (
                  <div key={l.id}>
                    {divider}
                    <button
                      onClick={function() {
                        if (l.id === "account" && !currentUser) {
                          setAuthScreen("login");
                          setDrawer(false);
                          return;
                        }
                        navTo(l.id);
                        setDrawer(false);
                      }}
                      className={"flex items-center gap-3.5 py-3 px-5 border-none w-full text-left cursor-pointer transition-all duration-150 text-[13px] font-semibold " + (isActive ? "bg-[rgba(232,168,56,0.08)] text-[#E8A838]" : "bg-transparent text-[#C8BFB0]")}
                    >
                      <span className="min-w-[22px] flex items-center justify-center">
                        <Icon name={l.icon} size={17} className={isActive ? "opacity-100" : "opacity-70"} />
                      </span>
                      {l.label}
                    </button>
                  </div>
                );
              });
            })()}

            <div className="mt-auto p-5">
              {!isAdmin ? (
                <Btn variant="ghost" className="w-full" onClick={function() { setDrawer(false); setPwModal(true); }}>
                  Admin Login
                </Btn>
              ) : (
                <Btn variant="destructive" className="w-full" onClick={function() { setIsAdmin(false); setDrawer(false); toast("Admin off", "success"); }}>
                  Admin On
                </Btn>
              )}
            </div>
          </div>
        </>
      )}

      {/* Desktop top nav */}
      <nav className="top-nav" style={{ borderBottom: "1px solid rgba(155,114,207,.15)" }}>
        <div className="max-w-[1400px] mx-auto px-4 h-[54px] flex items-center gap-0">

          {/* Logo */}
          <div
            onClick={function() { navTo("home"); }}
            className="flex items-center gap-2 mr-3.5 shrink-0 cursor-pointer transition-[filter] duration-200 hover:drop-shadow-[0_0_12px_rgba(232,168,56,0.4)]"
          >
            <img
              src="/icon-border.png"
              alt="TFT Clash"
              className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(155,114,207,0.55)]"
            />
            <div>
              <div className="gold-shimmer font-display text-sm font-bold leading-none tracking-[.06em]">
                TFT Clash
              </div>
              <div className="cond flex items-center gap-1 text-[10px] text-[#BECBD9] font-semibold tracking-[.06em]">
                <span className="border border-[rgba(232,168,56,0.4)] rounded px-1 text-[8px] text-[#E8A838] font-bold">S1</span>
                Season 1
              </div>
            </div>
          </div>

          {/* Desktop links */}
          <div className="desktop-links items-center gap-0 flex-1 min-w-0">
            {DESKTOP_PRIMARY.map(function(l) {
              var isLiveClash = l.id === "clash" && phase === "live";
              var isActive = screen === l.id;
              return (
                <button
                  key={l.id}
                  onClick={function() { navTo(l.id); }}
                  data-active={isActive ? "true" : "false"}
                  className={"border-none py-1.5 px-3 text-[12.5px] font-semibold cursor-pointer whitespace-nowrap shrink-0 rounded-lg transition-all duration-200 tracking-[.02em] font-condensed " + (isLiveClash
                    ? "bg-gradient-to-br from-[rgba(232,168,56,0.25)] to-[rgba(248,113,113,0.15)] text-[#E8A838] font-bold border border-[rgba(232,168,56,0.4)] shadow-[0_0_12px_rgba(232,168,56,0.3),0_0_24px_rgba(232,168,56,0.1)]"
                    : isActive
                      ? "bg-[rgba(232,168,56,0.1)] text-[#E8A838]"
                      : "bg-transparent text-[#9AAABF]"
                  )}
                >
                  {l.label}
                  {l.badge && (
                    <span
                      className={"ml-1.5 text-[10px] font-bold py-0.5 px-1.5 rounded " + (l.badgeColor === "#E8A838"
                        ? "bg-[rgba(232,168,56,0.15)] text-[#E8A838] border border-[rgba(232,168,56,0.3)]"
                        : "bg-[rgba(78,205,196,0.15)] text-[#4ECDC4] border border-[rgba(78,205,196,0.3)]"
                      )}
                    >
                      {l.badge}
                    </span>
                  )}
                </button>
              );
            })}

          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {/* Hamburger — opens drawer on all screen sizes */}
            <button
              className="bg-transparent border border-[rgba(242,237,228,0.1)] rounded-lg p-1.5 cursor-pointer text-[#C8D4E0] hover:text-[#F2EDE4] flex items-center justify-center transition-colors duration-150"
              onClick={function() { setDrawer(function(d) { return !d; }); }}
            >
              <Icon name="menu" size={20} />
            </button>

            {/* Dispute badge */}
            {dispCount > 0 && (
              <button
                onClick={function() { navTo("admin"); }}
                className="flex items-center gap-[5px] py-1 px-2.5 bg-[rgba(220,38,38,0.12)] border border-[rgba(220,38,38,0.4)] rounded-full cursor-pointer animate-[pulse-red_2s_infinite]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] inline-block" />
                <span className="text-[11px] font-bold text-[#F87171]">{dispCount}</span>
              </button>
            )}

            {/* Notification bell */}
            <NotificationBell
              notifications={notifications || []}
              onMarkAllRead={markAllRead || function() {}}
            />

            {/* User button or sign in/up */}
            {currentUser ? (
              <button
                onClick={function() { navTo("account"); }}
                className="flex items-center gap-1.5 bg-[rgba(232,168,56,0.08)] border border-[rgba(232,168,56,0.3)] rounded-full py-[5px] px-3 cursor-pointer transition-all duration-150 hover:border-[rgba(232,168,56,0.6)]"
              >
                {(function() {
                  var navPlayer = players && players.find(function(p) {
                    return p.auth_user_id === currentUser.id || p.authUserId === currentUser.id || p.name === currentUser.username;
                  });
                  var navPic = (navPlayer && navPlayer.profile_pic_url) || (currentUser.user_metadata && currentUser.user_metadata.profilePic) || "";
                  if (navPic) {
                    return <div className="w-5 h-5 rounded-full bg-cover bg-center shrink-0" style={{ backgroundImage: "url(" + navPic + ")" }} />;
                  }
                  return null;
                })()}
                <span className="text-xs font-semibold text-[#E8A838]">{currentUser.username}</span>
                <span className={"w-1.5 h-1.5 rounded-full inline-block shrink-0 " + (navProfileComplete === navProfileTotal ? "bg-[#52C47C]" : "bg-[#E8A838]")} />
              </button>
            ) : (
              <div className="flex gap-1.5">
                <Btn variant="ghost" size="sm" onClick={function() { setAuthScreen("login"); }}>Sign In</Btn>
                <Btn variant="primary" size="sm" onClick={function() { setAuthScreen("signup"); }}>Sign Up</Btn>
              </div>
            )}

            {/* Admin toggle */}
            {!isAdmin ? (
              <Btn variant="ghost" size="sm" onClick={function() { setPwModal(true); }}>Admin</Btn>
            ) : (
              <Btn variant="destructive" size="sm" onClick={function() { setIsAdmin(false); toast("Admin off", "success"); }}>
                Admin
              </Btn>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav className="mobile-bottom-bar fixed bottom-0 left-0 right-0 bg-[rgba(8,8,15,0.97)] border-t border-[rgba(242,237,228,0.08)] flex justify-around items-center py-2 pb-[calc(8px+env(safe-area-inset-bottom))] z-[9990] backdrop-blur-[12px]">
        {PRIMARY.map(function(item) {
          var isActive = screen === item.id || (item.id === "clash" && (screen === "bracket" || screen === "clash-register" || screen === "clash-live" || screen === "clash-results"));
          return (
            <button
              key={item.id}
              onClick={function() {
                if (item.id === "more") { setDrawer(true); }
                else { navTo(item.id); }
              }}
              className={"flex flex-col items-center gap-0.5 py-1 px-3 cursor-pointer relative bg-transparent border-none font-condensed " + (isActive ? "text-[#F2EDE4]" : "text-[#9AAABF]")}
            >
              {item.glow && (
                <div className="absolute top-0.5 right-2 w-1.5 h-1.5 rounded-full bg-[#E8A838] shadow-[0_0_8px_#E8A838]" />
              )}
              {item.badge && (
                <span
                  className={"absolute top-0 right-0.5 text-[7px] font-bold py-[1px] px-1 rounded-[3px] " + (item.badgeColor === "#E8A838"
                    ? "bg-[rgba(232,168,56,0.2)] text-[#E8A838]"
                    : "bg-[rgba(78,205,196,0.2)] text-[#4ECDC4]"
                  )}
                >
                  {item.badge}
                </span>
              )}
              <Icon name={item.icon} size={20} />
              <span className="text-[10px] tracking-[.04em]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
