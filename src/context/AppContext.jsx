import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { DEFAULT_SEASON_CONFIG, setSeasonChampion, SEED, PAST_CLASHES } from '../lib/constants.js';
import { getUserTier } from '../lib/tiers.js';

var AppContext = createContext(null);

export function AppProvider(props) {
  var children = props.children;

  // ── Screen / routing state ──
  // Initialize from pathname (React Router) with hash fallback for migration
  var _screen = useState(function(){
    var p=window.location.pathname;
    if(p&&p!=="/"&&p!=="/index.html"){
      var seg=p.replace(/^\//,"").split("/")[0];
      if(seg)return seg;
    }
    var h=window.location.hash.replace("#","");
    var parts=h.split("/");
    return parts[0]||"home";
  });
  var screen = _screen[0];
  var setScreen = _screen[1];

  var _subRoute = useState(function(){
    var p=window.location.pathname;
    if(p&&p!=="/"&&p!=="/index.html"){
      var seg=p.replace(/^\//,"").split("/");
      return seg[1]||"";
    }
    var h=window.location.hash.replace("#","");
    var parts=h.split("/");
    return parts[1]||"";
  });
  var subRoute = _subRoute[0];
  var setSubRoute = _subRoute[1];

  // ── Core data state ──
  var _players = useState(function(){try{var s=localStorage.getItem("tft-players");return s?JSON.parse(s):[];}catch(e){return [];}});
  var players = _players[0];
  var setPlayers = _players[1];

  var _isLoadingData = useState(true);
  var isLoadingData = _isLoadingData[0];
  var setIsLoadingData = _isLoadingData[1];

  var _isAdmin = useState(false);
  var isAdmin = _isAdmin[0];
  var setIsAdmin = _isAdmin[1];

  var _scrimAccess = useState([]);
  var scrimAccess = _scrimAccess[0];
  var setScrimAccess = _scrimAccess[1];

  var _scrimHostAccess = useState([]);
  var scrimHostAccess = _scrimHostAccess[0];
  var setScrimHostAccess = _scrimHostAccess[1];

  var _tickerOverrides = useState([]);
  var tickerOverrides = _tickerOverrides[0];
  var setTickerOverrides = _tickerOverrides[1];

  var _scrimSessions = useState([]);
  var scrimSessions = _scrimSessions[0];
  var setScrimSessions = _scrimSessions[1];

  var _notifications = useState([]);
  var notifications = _notifications[0];
  var setNotifications = _notifications[1];

  var _toasts = useState([]);
  var toasts = _toasts[0];
  var setToasts = _toasts[1];

  var _disputes = useState([]);
  var disputes = _disputes[0];

  var _announcement = useState("");
  var announcement = _announcement[0];
  var setAnnouncement = _announcement[1];

  var _profilePlayer = useState(null);
  var profilePlayer = _profilePlayer[0];
  var setProfilePlayer = _profilePlayer[1];

  var _cmp = useState(null);
  var comparePlayer = _cmp[0];
  var setComparePlayer = _cmp[1];

  var _tournamentState = useState({phase:"idle",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[],registeredIds:[],waitlistIds:[],maxPlayers:24});
  var tournamentState = _tournamentState[0];
  var setTournamentState = _tournamentState[1];

  var _seasonConfig = useState(function(){try{var s=localStorage.getItem("tft-season-config");return s?JSON.parse(s):DEFAULT_SEASON_CONFIG;}catch(e){return DEFAULT_SEASON_CONFIG;}});
  var seasonConfig = _seasonConfig[0];
  var setSeasonConfig = _seasonConfig[1];

  var _quickClashes = useState(function(){try{var s=localStorage.getItem("tft-events");return s?JSON.parse(s):[];}catch(e){return [];}});
  var quickClashes = _quickClashes[0];
  var setQuickClashes = _quickClashes[1];

  var _orgSponsors = useState(function(){try{var s=localStorage.getItem("tft-sponsors");var p=s?JSON.parse(s):[];return Array.isArray(p)?p:[];}catch(e){return [];}});
  var orgSponsors = _orgSponsors[0];
  var setOrgSponsors = _orgSponsors[1];

  var _scheduledEvents = useState(function(){try{var s=localStorage.getItem('tft-scheduled-events');return s?JSON.parse(s):[];}catch(e){return [];}});
  var scheduledEvents = _scheduledEvents[0];
  var setScheduledEvents = _scheduledEvents[1];

  var _auditLog = useState([]);
  var auditLog = _auditLog[0];
  var setAuditLog = _auditLog[1];

  var _hostApps = useState([]);
  var hostApps = _hostApps[0];
  var setHostApps = _hostApps[1];

  var _hostTournaments = useState([]);
  var hostTournaments = _hostTournaments[0];
  var setHostTournaments = _hostTournaments[1];

  var _hostBranding = useState({});
  var hostBranding = _hostBranding[0];
  var setHostBranding = _hostBranding[1];

  var _hostAnnouncements = useState([]);
  var hostAnnouncements = _hostAnnouncements[0];
  var setHostAnnouncements = _hostAnnouncements[1];

  var _pastClashes = useState([]);
  var pastClashes = _pastClashes[0];
  var setPastClashes = _pastClashes[1];

  var _featuredEvents = useState(function(){try{var s=localStorage.getItem('tft-featured-events');return s?JSON.parse(s):[];}catch(e){return [];}});
  var featuredEvents = _featuredEvents[0];
  var setFeaturedEvents = _featuredEvents[1];

  var _challengeCompletions = useState(function(){try{var s=localStorage.getItem('tft-challenge-completions');return s?JSON.parse(s):{};}catch(e){return {};}});
  var challengeCompletions = _challengeCompletions[0];
  var setChallengeCompletions = _challengeCompletions[1];

  var _pendingResults = useState([]);
  var pendingResults = _pendingResults[0];
  var setPendingResults = _pendingResults[1];

  var _allPendingResults = useState([]);
  var allPendingResults = _allPendingResults[0];
  var setAllPendingResults = _allPendingResults[1];

  // Auth state
  var _currentUser = useState(null);
  var currentUser = _currentUser[0];
  var setCurrentUser = _currentUser[1];

  var _isAuthLoading = useState(true);
  var isAuthLoading = _isAuthLoading[0];
  var setIsAuthLoading = _isAuthLoading[1];

  var _isOffline = useState(false);
  var isOffline = _isOffline[0];
  var setIsOffline = _isOffline[1];

  var _sub = useState({});
  var subscriptions = _sub[0];
  var setSubscriptions = _sub[1];

  var _authScreen = useState(null); // "login" | "signup" | null
  var authScreen = _authScreen[0];
  var setAuthScreen = _authScreen[1];

  var _passwordRecovery = useState(false);
  var passwordRecovery = _passwordRecovery[0];
  var setPasswordRecovery = _passwordRecovery[1];

  var _cookieConsent = useState(function(){try{return localStorage.getItem("tft-cookie-consent")==="1";}catch(e){return false;}});
  var cookieConsent = _cookieConsent[0];
  var setCookieConsent = _cookieConsent[1];

  var _onb = useState(false);
  var showOnboarding = _onb[0];
  var setShowOnboarding = _onb[1];

  // Newsletter + push notification state
  var newsletterEmailRef = useRef(null);

  var _newsletterSubmitted = useState(function(){try{var subs=JSON.parse(localStorage.getItem("tft-newsletter-subs")||"[]");return subs.length>0;}catch(e){return false;}});
  var newsletterSubmitted = _newsletterSubmitted[0];
  var setNewsletterSubmitted = _newsletterSubmitted[1];

  var _clashRemindersOn = useState(function(){try{return localStorage.getItem("tft-clash-reminders")==="1";}catch(e){return false;}});
  var clashRemindersOn = _clashRemindersOn[0];
  var setClashRemindersOn = _clashRemindersOn[1];

  // ── Refs for realtime tracking ──
  var rtRef = useRef({tournament_state:false,quick_clashes:false,announcement:false,season_config:false,org_sponsors:false,scheduled_events:false,audit_log:false,featured_events:false,challenge_completions:false,scrim_host_access:false,scrim_access:false,scrim_data:false,ticker_overrides:false});
  var announcementInitRef = useRef(false);
  var settingsLoadedRef = useRef(false); // true once site_settings are fetched — guards sync useEffects from overwriting DB on mount
  var navSourceRef = useRef("user");

  // ── Helper functions ──

  function toast(msg,type){var id=Date.now()+Math.random();setToasts(function(ts){return ts.concat([{id:id,msg:msg,type:type}]);});}

  function removeToast(id){setToasts(function(ts){return ts.filter(function(t){return t.id!==id;});});}

  function markAllRead(){
    if(!currentUser)return;
    supabase.from('notifications').update({read:true})
      .eq('user_id',currentUser.id).eq('read',false)
      .then(function(){
        setNotifications(function(prev){
          return prev.map(function(n){return Object.assign({},n,{read:true});});
        });
      });
  }

  // ── Load players from normalized players table (primary source of truth) ──
  function loadPlayersFromTable(){
    if(!supabase.from)return;
    supabase.from('players').select('*').order('username',{ascending:true})
      .then(function(res){
        if(res.error){console.error("[TFT] Failed to load players:",res.error);
          // On error, keep whatever is already in state -- do NOT overwrite with SEED
          return;}
        if(!res.data||!res.data.length){
          // Only seed if the table is truly empty (count check)
          supabase.from('players').select('id',{count:'exact',head:true}).then(function(countRes){
            if(countRes.count===0){
              if(supabase.from){supabase.from('players').upsert(SEED,{onConflict:'id'}).then(function(){setPlayers(SEED);}).catch(function(){setPlayers(SEED);});}else{setPlayers(SEED);}
            }
          }).catch(function(){/* leave state as-is if count fails */});
          return;}
        var mapped=res.data.map(function(r){
          return{
            id:r.id,name:r.username,username:r.username,
            riotId:r.riot_id||'',rank:r.rank||'Iron',region:r.region||'EUW',
            bio:r.bio||'',discord_user_id:r.discord_user_id||null,
            authUserId:r.auth_user_id||null,auth_user_id:r.auth_user_id||null,
            twitch:(r.social_links&&r.social_links.twitch)||'',
            twitter:(r.social_links&&r.social_links.twitter)||'',
            youtube:(r.social_links&&r.social_links.youtube)||'',
            pts:r.season_pts||0,wins:r.wins||0,top4:r.top4||0,games:r.games||0,
            avg:r.avg_placement?String(r.avg_placement):"0",
            banned:!!r.banned,dnpCount:r.dnp_count||0,notes:r.notes||'',checkedIn:!!r.checked_in,
            profilePicUrl:r.avatar_url||r.profile_pic_url||'',
            clashHistory:[],sparkline:[],bestStreak:0,currentStreak:0,
            tiltStreak:0,bestHaul:0,attendanceStreak:0,lastClashId:null,
            role:r.role||"player",sponsor:r.sponsor_json||null,
            lastClashRank:r.last_clash_rank||null,consistencyGrade:r.consistency_grade||'',
            tierOverride:r.tier_override||null
          };
        });
        // Enrich with game_results for detailed stats (clashHistory, streaks, etc.)
        // Use freshly-fetched `mapped` array (not stale `players` state) to avoid race condition
        var freshMapped=mapped;
        supabase.from('game_results').select('player_id,placement,points,round_number,tournament_id,game_number')
          .order('tournament_id',{ascending:true}).order('round_number',{ascending:true}).order('game_number',{ascending:true})
          .limit(500)
          .then(function(gr){
            if(!gr.error&&gr.data&&gr.data.length>0){
              var historyMap={};
              gr.data.forEach(function(g){
                var pid=g.player_id;
                if(!historyMap[pid])historyMap[pid]=[];
                historyMap[pid].push({place:g.placement,placement:g.placement,points:g.points,round:g.round_number,tournamentId:g.tournament_id,gameNumber:g.game_number});
              });
              mapped=freshMapped.map(function(p){
                var hist=historyMap[p.id];
                if(!hist||!hist.length)return p;
                var totalPts=hist.reduce(function(s,g){return s+(g.points||0);},0);
                var wins=hist.filter(function(g){return g.placement===1;}).length;
                var top4=hist.filter(function(g){return g.placement<=4;}).length;
                var avgP=hist.reduce(function(s,g){return s+g.placement;},0)/hist.length;
                // Count distinct tournaments attended
                var tournamentSet={};
                hist.forEach(function(g){if(g.tournamentId)tournamentSet[g.tournamentId]=true;});
                var totalClashes=Object.keys(tournamentSet).length||hist.length;
                // Compute win streaks from history (consecutive wins from most recent)
                var curStreak=0;
                for(var ci=hist.length-1;ci>=0;ci--){
                  if(hist[ci].placement===1)curStreak++;
                  else break;
                }
                // Compute best win streak across entire history
                var bestStr=0, runStr=0;
                for(var bi=0;bi<hist.length;bi++){
                  if(hist[bi].placement===1){runStr++;if(runStr>bestStr)bestStr=runStr;}
                  else{runStr=0;}
                }
                // Attendance streak: consecutive tournaments with results (last N)
                var tidList=Object.keys(tournamentSet).sort();
                var attStreak=tidList.length;
                return Object.assign({},p,{
                  pts:totalPts,wins:wins,top4:top4,games:hist.length,
                  avg:avgP.toFixed(1),clashHistory:hist,
                  currentStreak:curStreak,bestStreak:bestStr,
                  attendanceStreak:attStreak,totalClashes:totalClashes
                });
              });
            }
            setPlayers(mapped);
          }).catch(function(e){ console.error("[TFT] game_results enrichment failed:", e); setPlayers(freshMapped); });
      });
  }

  // ── useEffect: clash reminders localStorage sync ──
  useEffect(function(){try{localStorage.setItem("tft-clash-reminders",clashRemindersOn?"1":"0");}catch(e){}},[clashRemindersOn]);

  // ── useEffect: load notifications ──
  useEffect(function(){
    if(!currentUser)return;
    supabase.from('notifications').select('*')
      .eq('user_id',currentUser.id)
      .order('created_at',{ascending:false})
      .limit(20)
      .then(function(res){
        if(res.data){
          setNotifications(res.data.map(function(n){
            var d=n.created_at?new Date(n.created_at):null;
            var time=d?d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"";
            return Object.assign({},n,{time:time});
          }));
        }
      });
  },[currentUser]);

  // ── useEffect: load own subscription ──
  useEffect(function(){
    if(!currentUser || !currentUser.auth_user_id || !supabase.from) return;
    supabase.from("subscriptions").select("*").eq("user_id", currentUser.auth_user_id).limit(1).then(function(res){
      if(res.data){
        var map={};
        res.data.forEach(function(s){map[s.user_id]=s;});
        setSubscriptions(map);
      }
    });
  },[currentUser]);

  // ── useEffect: auth listener ──
  useEffect(function(){

    function mapUser(u){
      if(!u)return null;
      var discordName=u.identities&&u.identities.find(function(i){return i.provider==='discord';});
      discordName=discordName&&discordName.identity_data&&discordName.identity_data.global_name;
      if(!discordName)discordName=u.user_metadata&&u.user_metadata.full_name;
      var username=(u.user_metadata&&u.user_metadata.username)||discordName||(u.email&&u.email.split('@')[0])||"Player";
      var riotId=(u.user_metadata&&u.user_metadata.riotId)||(u.user_metadata&&u.user_metadata.riot_id)||"";
      var region=(u.user_metadata&&u.user_metadata.riotRegion)||(u.user_metadata&&u.user_metadata.riot_region)||(u.user_metadata&&u.user_metadata.region)||"EUW";
      return Object.assign({},u,{username:username,riotId:riotId,region:region});
    }

    function fetchAndSetCurrentUser(authUser, onDone) {
      if (!authUser) { setCurrentUser(null); if (onDone) onDone(); return; }
      supabase.from('players').select('*').eq('auth_user_id', authUser.id).single()
        .then(function(result) {
          if (result.data) {
            setCurrentUser(result.data);
          } else {
            if (result.error && result.error.code !== 'PGRST116') {
              console.error('[TFT] fetchAndSetCurrentUser error:', result.error.message);
            }
            setCurrentUser(mapUser(authUser));
          }
          if (onDone) onDone();
        })
        .catch(function() {
          setCurrentUser(mapUser(authUser));
          if (onDone) onDone();
        });
    }

    supabase.auth.getSession().then(function(result){
      var session=result&&result.data&&result.data.session;
      fetchAndSetCurrentUser(session&&session.user?session.user:null, function(){setIsAuthLoading(false);});
    }).catch(function(){setIsAuthLoading(false);});

    var authResult=supabase.auth.onAuthStateChange(function(_e,session){
      if (_e === 'PASSWORD_RECOVERY') { setPasswordRecovery(true); }
      fetchAndSetCurrentUser(session&&session.user?session.user:null, null);
    });
    var subscription=authResult.data.subscription;

    return function(){subscription.unsubscribe();};

  },[]);

  // ── useEffect: auto-create player row for OAuth users ──
  useEffect(function(){
    if(!currentUser||!currentUser.id)return;
    // If currentUser already has player table fields (rank, pts), skip re-fetch
    if(currentUser.auth_user_id)return;
    // Wait for a confirmed session before hitting the DB — Discord OAuth can fire
    // onAuthStateChange before the JWT is fully set in the client, causing auth.uid()
    // to return null server-side and silently fail the RLS check on insert.
    supabase.auth.getSession().then(function(sessionRes){
      if(!sessionRes.data||!sessionRes.data.session)return;
      supabase.from('players').select('*').eq('auth_user_id',currentUser.id).maybeSingle()
        .then(function(res){
          if(res.error){console.error("[TFT] player check failed:",res.error);return;}
          if(res.data){
            setCurrentUser(Object.assign({}, res.data, { riotId: res.data.riot_id || '' }));
            loadPlayersFromTable();
            return;
          }
          var username=currentUser.username||currentUser.email&&currentUser.email.split('@')[0]||"Player";
          var riotId=currentUser.riotId||"";
          var region=currentUser.region||"EUW";
          supabase.from('players').insert({
            username:username,
            riot_id:riotId,
            region:region,
            rank:'Iron',
            auth_user_id:currentUser.id
          }).select().single().then(function(ins){
            if(ins.error){
              console.error("[TFT] auto-create player failed:",ins.error);
              if(ins.error.code==='23505'){loadPlayersFromTable();}
              return;
            }
            if(ins.data)setCurrentUser(Object.assign({}, ins.data, { riotId: ins.data.riot_id || '' }));
            loadPlayersFromTable();
          });
        });
    });
  },[currentUser&&currentUser.id]);

  // ── useEffect: monitor realtime connection status for offline banner ──
  useEffect(function(){
    var channel=supabase.channel("app-status");
    channel.on("system",{},function(payload){
      if(payload.extension==="error"||payload.status==="channel_error"){
        setIsOffline(true);
      }
    });
    channel.subscribe(function(status){
      if(status==="SUBSCRIBED")setIsOffline(false);
      if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")setIsOffline(true);
    });
    return function(){supabase.removeChannel(channel);};
  },[]);

  // ── useEffect: load host data from DB tables on auth ──
  useEffect(function(){
    if(!currentUser||!supabase.from)return;
    // Load host branding from host_profiles
    supabase.from("host_profiles").select("*").eq("user_id",currentUser.auth_user_id).maybeSingle()
      .then(function(res){
        if(res.data&&res.data.status==="approved"){
          setHostBranding({name:res.data.org_name||"",logo:res.data.logo_url||"\ud83c\udfae",color:res.data.brand_color||"#9B72CF",bio:res.data.bio||"",logoUrl:res.data.logo_url||"",bannerUrl:res.data.banner_url||""});
        }
      });
    // Load host applications from host_applications table
    if(isAdmin){
      supabase.from("host_applications").select("*").order("created_at",{ascending:false}).then(function(res){
        if(res.data)setHostApps(res.data);
      });
    } else {
      supabase.from("host_applications").select("*").eq("user_id",currentUser.auth_user_id).then(function(res){
        if(res.data)setHostApps(res.data);
      });
    }
  },[currentUser, isAdmin]);

  // ── popstate handler removed: React Router handles navigation ──

  // ── useEffect: stamp checkedIn from tournamentState.checkedInIds onto players ──
  useEffect(function(){
    var ids=new Set((tournamentState.checkedInIds||[]).map(String));
    setPlayers(function(ps){return ps.map(function(p){return Object.assign({},p,{checkedIn:ids.has(String(p.id))});});});
  },[tournamentState.checkedInIds]);

  // ── localStorage sync (fast cache) ──
  useEffect(function(){var t=setTimeout(function(){try{localStorage.setItem("tft-players",JSON.stringify(players));}catch(e){}},300);return function(){clearTimeout(t);};},[players]);

  // isAdmin is derived solely from currentUser.is_admin (DB field) -- no localStorage write

  // ── useEffect: sync isAdmin from currentUser.is_admin (DB source of truth only) ──
  useEffect(function(){
    setIsAdmin(!!(currentUser && currentUser.is_admin === true));
    // Ensure user_roles entry exists for admins so RLS policies work correctly
    if(currentUser && currentUser.is_admin === true && currentUser.auth_user_id && supabase.from){
      supabase.from('user_roles').upsert(
        {user_id: currentUser.auth_user_id, role: 'admin'},
        {onConflict: 'user_id,role'}
      );
    }
  }, [currentUser]);

  useEffect(function(){var t=setTimeout(function(){try{localStorage.setItem("tft-season-config",JSON.stringify(seasonConfig));}catch(e){}},300);return function(){clearTimeout(t);};},[seasonConfig]);

  useEffect(function(){var t=setTimeout(function(){try{localStorage.setItem("tft-events",JSON.stringify(quickClashes));}catch(e){}},300);return function(){clearTimeout(t);};},[quickClashes]);

  useEffect(function(){var t=setTimeout(function(){try{localStorage.setItem("tft-sponsors",JSON.stringify(orgSponsors));}catch(e){}},300);return function(){clearTimeout(t);};},[orgSponsors]);

  useEffect(function(){var t=setTimeout(function(){try{localStorage.setItem("tft-scheduled-events",JSON.stringify(scheduledEvents));}catch(e){}},300);return function(){clearTimeout(t);};},[scheduledEvents]);

  // hostApps now loaded from host_applications table, no localStorage sync needed

  // ── Supabase shared state - single channel for all keys ──
  useEffect(function(){

    if(!supabase.from){setIsLoadingData(false);return;}

    // Players: load from normalized players table
    loadPlayersFromTable();

    // Settings/config: load from site_settings
    supabase.from('site_settings').select('key,value')
      .in('key',['tournament_state','quick_clashes','announcement','season_config','org_sponsors','scheduled_events','audit_log','scrim_host_access','scrim_access','scrim_data','ticker_overrides','featured_events','challenge_completions'])
      .then(function(res){

        if(!res.data){setIsLoadingData(false);return;}

        res.data.forEach(function(row){
          try{
            if(row.key==='announcement'){rtRef.current.announcement=true;setAnnouncement(typeof row.value==='string'?row.value:JSON.stringify(row.value)||'');}
            else{
              var val=typeof row.value==='string'?JSON.parse(row.value):row.value;

              if(row.key==='tournament_state'&&val){rtRef.current.tournament_state=true;setTournamentState(val);}
              if(row.key==='quick_clashes'&&Array.isArray(val)){rtRef.current.quick_clashes=true;setQuickClashes(val);}
              if(row.key==='season_config'&&val){rtRef.current.season_config=true;setSeasonConfig(val);}
              if(row.key==='org_sponsors'&&val){rtRef.current.org_sponsors=true;setOrgSponsors(Array.isArray(val)?val:[]);}
              if(row.key==='scheduled_events'&&Array.isArray(val)){rtRef.current.scheduled_events=true;setScheduledEvents(val);}
              if(row.key==='audit_log'&&Array.isArray(val)){rtRef.current.audit_log=true;setAuditLog(val);}
              if(row.key==='scrim_host_access'&&Array.isArray(val)){rtRef.current.scrim_host_access=true;setScrimHostAccess(val);}
              if(row.key==='scrim_access'&&Array.isArray(val)){rtRef.current.scrim_access=true;setScrimAccess(val);}
              if(row.key==='ticker_overrides'&&Array.isArray(val)){rtRef.current.ticker_overrides=true;setTickerOverrides(val);}
              if(row.key==='scrim_data'&&Array.isArray(val)){rtRef.current.scrim_data=true;setScrimSessions(val);}
              if(row.key==='featured_events'&&Array.isArray(val)){rtRef.current.featured_events=true;setFeaturedEvents(val);}
              if(row.key==='challenge_completions'&&val){rtRef.current.challenge_completions=true;setChallengeCompletions(val);}
            }
          }catch(e){console.warn("Failed to parse site_settings row:",row.key,e);}
        });

        announcementInitRef.current=true;
        settingsLoadedRef.current=true;

        // Reconcile registrations from DB
        setTournamentState(function(ts){
          if(!ts.dbTournamentId)return ts;
          supabase.from('registrations').select('player_id,status')
            .eq('tournament_id',ts.dbTournamentId)
            .then(function(regRes){
              if(regRes.error||!regRes.data)return;
              var regIds=[];
              var checkIds=[];
              regRes.data.forEach(function(r){
                if(r.status==='registered'||r.status==='checked_in')regIds.push(String(r.player_id));
                if(r.status==='checked_in')checkIds.push(String(r.player_id));
              });
              setTournamentState(function(ts2){
                rtRef.current.tournament_state=true;
                return Object.assign({},ts2,{registeredIds:regIds,checkedInIds:checkIds.length>0?checkIds:ts2.checkedInIds||[]});
              });
            });
          return ts;
        });

        setIsLoadingData(false);

      });

    // realtime - push changes to all browsers instantly
    var ch=supabase.channel('shared_state')
      .on('postgres_changes',{event:'*',schema:'public',table:'site_settings'},function(payload){
        try{
          var key=payload.new&&payload.new.key;
          var raw=payload.new&&payload.new.value;
          if(!key)return;

          if(key==='announcement'){rtRef.current.announcement=true;setAnnouncement(typeof raw==='string'?raw:JSON.stringify(raw)||'');return;}

          var val=typeof raw==='string'?JSON.parse(raw||'null'):raw;
          if(!val)return;

          if(key==='tournament_state'){rtRef.current.tournament_state=true;setTournamentState(val);}
          if(key==='quick_clashes'&&Array.isArray(val)){rtRef.current.quick_clashes=true;setQuickClashes(val);}
          if(key==='season_config'&&val){rtRef.current.season_config=true;setSeasonConfig(val);}
          if(key==='org_sponsors'&&val){rtRef.current.org_sponsors=true;setOrgSponsors(Array.isArray(val)?val:[]);}
          if(key==='scheduled_events'&&Array.isArray(val)){rtRef.current.scheduled_events=true;setScheduledEvents(val);}
          if(key==='audit_log'&&Array.isArray(val)){rtRef.current.audit_log=true;setAuditLog(val);}
          if(key==='scrim_host_access'&&Array.isArray(val)){rtRef.current.scrim_host_access=true;setScrimHostAccess(val);}
          if(key==='scrim_access'&&Array.isArray(val)){rtRef.current.scrim_access=true;setScrimAccess(val);}
          if(key==='ticker_overrides'&&Array.isArray(val)){rtRef.current.ticker_overrides=true;setTickerOverrides(val);}
          if(key==='scrim_data'&&Array.isArray(val)){rtRef.current.scrim_data=true;setScrimSessions(val);}
          if(key==='featured_events'&&Array.isArray(val)){rtRef.current.featured_events=true;setFeaturedEvents(val);}
          if(key==='challenge_completions'&&val){rtRef.current.challenge_completions=true;setChallengeCompletions(val);}
        }catch(e){console.warn("Failed to parse realtime update:",e);}
      })
      .subscribe();

    // Realtime on players table
    var playersCh=supabase.channel('players_realtime')
      .on('postgres_changes',{event:'*',schema:'public',table:'players'},function(){
        loadPlayersFromTable();
      })
      .subscribe();

    // Realtime on game_results
    var gameResultsCh=supabase.channel('game_results_realtime')
      .on('postgres_changes',{event:'*',schema:'public',table:'game_results'},function(){
        loadPlayersFromTable();
      })
      .subscribe();

    // Realtime on registrations
    var regCh=supabase.channel('registrations_realtime')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'registrations'},function(payload){
        var row=payload.new;
        if(!row||!row.player_id)return;
        var pid=String(row.player_id);
        if(row.status==='checked_in'){
          setTournamentState(function(ts){
            var ids=new Set((ts.checkedInIds||[]).map(String));
            ids.add(pid);
            return Object.assign({},ts,{checkedInIds:Array.from(ids)});
          });
        }
        if(row.status==='registered'){
          setTournamentState(function(ts){
            var ids=new Set((ts.registeredIds||[]).map(String));
            ids.add(pid);
            return Object.assign({},ts,{registeredIds:Array.from(ids)});
          });
        }
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'registrations'},function(payload){
        var row=payload.new;
        if(!row||!row.player_id)return;
        var pid=String(row.player_id);
        if(row.status==='checked_in'){
          setTournamentState(function(ts){
            var cids=new Set((ts.checkedInIds||[]).map(String));
            cids.add(pid);
            return Object.assign({},ts,{checkedInIds:Array.from(cids)});
          });
        }
      })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'registrations'},function(payload){
        var old=payload.old;
        if(!old||!old.player_id)return;
        var pid=String(old.player_id);
        setTournamentState(function(ts){
          return Object.assign({},ts,{
            registeredIds:(ts.registeredIds||[]).filter(function(id){return String(id)!==pid;}),
            checkedInIds:(ts.checkedInIds||[]).filter(function(id){return String(id)!==pid;})
          });
        });
      })
      .subscribe();

    return function(){supabase.removeChannel(ch);supabase.removeChannel(playersCh);supabase.removeChannel(gameResultsCh);supabase.removeChannel(regCh);};

  },[]);

  // ── save shared state to Supabase on every change (skip if change came from Supabase) ──

  useEffect(function(){
    if(rtRef.current.tournament_state){rtRef.current.tournament_state=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'tournament_state',value:JSON.stringify(tournamentState),updated_at:new Date().toISOString()})
      .then(function(res){if(res.error)console.error("[TFT] Failed to sync tournament_state:",res.error);});
  },[tournamentState]);

  useEffect(function(){
    if(rtRef.current.quick_clashes){rtRef.current.quick_clashes=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'quick_clashes',value:JSON.stringify(quickClashes),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[quickClashes]);

  useEffect(function(){
    if(!announcementInitRef.current)return;
    if(rtRef.current.announcement){rtRef.current.announcement=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'announcement',value:JSON.stringify(announcement),updated_at:new Date().toISOString()}).then(function(res){if(res.error)console.error("[TFT] Failed to sync announcement:",res.error);});
  },[announcement]);

  useEffect(function(){
    if(rtRef.current.season_config){rtRef.current.season_config=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'season_config',value:JSON.stringify(seasonConfig),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[seasonConfig]);

  useEffect(function(){
    if(rtRef.current.org_sponsors){rtRef.current.org_sponsors=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'org_sponsors',value:JSON.stringify(orgSponsors),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[orgSponsors]);

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.scheduled_events){rtRef.current.scheduled_events=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'scheduled_events',value:JSON.stringify(scheduledEvents),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[scheduledEvents]);

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.audit_log){rtRef.current.audit_log=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'audit_log',value:JSON.stringify(auditLog),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[auditLog]);

  // hostApps now managed via host_applications table, no site_settings sync

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.scrim_host_access){rtRef.current.scrim_host_access=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'scrim_host_access',value:JSON.stringify(scrimHostAccess),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[scrimHostAccess]);

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.scrim_access){rtRef.current.scrim_access=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'scrim_access',value:JSON.stringify(scrimAccess),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[scrimAccess]);

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.scrim_data){rtRef.current.scrim_data=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'scrim_data',value:JSON.stringify(scrimSessions),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[scrimSessions]);

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.ticker_overrides){rtRef.current.ticker_overrides=false;return;}
    if(supabase.from)supabase.from('site_settings').upsert({key:'ticker_overrides',value:JSON.stringify(tickerOverrides),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[tickerOverrides]);

  // hostTournaments, hostBranding, hostAnnouncements now managed via DB tables, no site_settings sync

  useEffect(function(){
    if(rtRef.current.featured_events){rtRef.current.featured_events=false;return;}
    localStorage.setItem('tft-featured-events',JSON.stringify(featuredEvents));
    if(supabase.from)supabase.from('site_settings').upsert({key:'featured_events',value:JSON.stringify(featuredEvents),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[featuredEvents]);

  useEffect(function(){
    if(rtRef.current.challenge_completions){rtRef.current.challenge_completions=false;return;}
    localStorage.setItem('tft-challenge-completions',JSON.stringify(challengeCompletions));
    if(supabase.from)supabase.from('site_settings').upsert({key:'challenge_completions',value:JSON.stringify(challengeCompletions),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)console.error("[TFT] Sync error:",res.error);});
  },[challengeCompletions]);

  // ── Load past clashes from tournament_results + tournaments tables ──
  var playersLoadedCount=players.length;
  useEffect(function(){
    if(!supabase.from||!playersLoadedCount)return;
    supabase.from('tournaments').select('id,name,date').eq('phase','complete').order('date',{ascending:false}).limit(50)
      .then(function(res){
        if(res.error){console.error("Failed to load tournaments:",res.error);return;}
        if(!res.data||!res.data.length){setPastClashes(PAST_CLASHES);return;}
        var tIds=res.data.map(function(t){return t.id;});
        supabase.from('tournament_results').select('tournament_id,player_id,final_placement,total_points')
          .in('tournament_id',tIds).order('final_placement',{ascending:true})
          .then(function(rRes){
            if(rRes.error){console.error("Failed to load results:",rRes.error);return;}
            if(!rRes.data)return;
            var playersCopy=players;
            var clashes=res.data.map(function(t){
              var results=rRes.data.filter(function(r){return r.tournament_id===t.id;});
              var top8=results.slice(0,8).map(function(r){
                var p=playersCopy.find(function(pl){return String(pl.id)===String(r.player_id);});
                return p?p.name:('Player '+r.player_id);
              });
              return{id:t.id,name:t.name,date:t.date,season:'S1',players:results.length,lobbies:Math.ceil(results.length/8),champion:top8[0]||'Unknown',top3:top8};
            });
            setPastClashes(clashes);
          });
      });
  },[playersLoadedCount]);

  // ── Load player's own pending results ──
  useEffect(function(){
    if(!currentUser||!tournamentState.dbTournamentId||!supabase.from)return;
    supabase.from('pending_results')
      .select('*')
      .eq('tournament_id',tournamentState.dbTournamentId)
      .eq('player_id',currentUser.id)
      .then(function(res){
        if(res.data)setPendingResults(res.data);
      });
  },[currentUser&&currentUser.id,tournamentState.id]);

  // ── Realtime subscription for player's own pending results ──
  useEffect(function(){
    if(!currentUser||!supabase.channel)return;
    var prChannel=supabase
      .channel('pending-results-player')
      .on('postgres_changes',{
        event:'*',
        schema:'public',
        table:'pending_results',
        filter:'player_id=eq.'+currentUser.id
      },function(payload){
        if(payload.eventType==='DELETE'){
          setPendingResults(function(prev){
            return prev.filter(function(r){return r.id!==payload.old.id;});
          });
        }else{
          setPendingResults(function(prev){
            var existing=prev.filter(function(r){return r.id!==payload.new.id;});
            return existing.concat([payload.new]);
          });
        }
      })
      .subscribe();
    return function(){supabase.removeChannel(prChannel);};
  },[currentUser&&currentUser.id]);

  // ── Load all pending results for admin ──
  useEffect(function(){
    if(!isAdmin||!tournamentState.dbTournamentId||!supabase.from)return;
    supabase.from('pending_results')
      .select('*')
      .eq('tournament_id',tournamentState.dbTournamentId)
      .then(function(res){
        if(res.data)setAllPendingResults(res.data);
      });

    var adminPrChannel=supabase
      .channel('pending-results-admin')
      .on('postgres_changes',{
        event:'*',schema:'public',table:'pending_results'
      },function(payload){
        if(payload.eventType==='DELETE'){
          setAllPendingResults(function(prev){
            return prev.filter(function(r){return r.id!==payload.old.id;});
          });
        }else{
          setAllPendingResults(function(prev){
            var without=prev.filter(function(r){return r.id!==payload.new.id;});
            return without.concat([payload.new]);
          });
        }
      })
      .subscribe();

    return function(){supabase.removeChannel(adminPrChannel);};
  },[isAdmin,tournamentState.id]);

  // ── Compute season champion from live standings ──
  var computedChampion=useMemo(function(){
    if(!players||players.length===0)return null;
    var scSorted=players.slice().sort(function(a,b){return(b.pts||0)-(a.pts||0);});
    var scTop=scSorted[0];
    if(scTop&&scTop.pts>0){
      return{name:scTop.name,title:"Season Leader",season:seasonConfig.name||"Season 1",since:"",pts:scTop.pts,wins:scTop.wins||0,rank:scTop.rank||"Challenger"};
    }
    return null;
  },[players,seasonConfig]);
  useEffect(function(){ setSeasonChampion(computedChampion); },[computedChampion]);

  // ── Compute user tier ──
  var userTier=currentUser?getUserTier(subscriptions,currentUser.id):"free";

  // ── Build context value ──
  var value = useMemo(function(){
    return {
      // Screen / routing
      screen: screen, setScreen: setScreen,
      subRoute: subRoute, setSubRoute: setSubRoute,
      navSourceRef: navSourceRef,

      // Core data
      players: players, setPlayers: setPlayers,
      isLoadingData: isLoadingData,
      isAdmin: isAdmin, setIsAdmin: setIsAdmin,
      scrimAccess: scrimAccess, setScrimAccess: setScrimAccess,
      scrimHostAccess: scrimHostAccess, setScrimHostAccess: setScrimHostAccess,
      tickerOverrides: tickerOverrides, setTickerOverrides: setTickerOverrides,
      scrimSessions: scrimSessions, setScrimSessions: setScrimSessions,
      notifications: notifications, setNotifications: setNotifications,
      toasts: toasts,
      disputes: disputes,
      announcement: announcement, setAnnouncement: setAnnouncement,
      profilePlayer: profilePlayer, setProfilePlayer: setProfilePlayer,
      comparePlayer: comparePlayer, setComparePlayer: setComparePlayer,
      tournamentState: tournamentState, setTournamentState: setTournamentState,
      seasonConfig: seasonConfig, setSeasonConfig: setSeasonConfig,
      quickClashes: quickClashes, setQuickClashes: setQuickClashes,
      orgSponsors: orgSponsors, setOrgSponsors: setOrgSponsors,
      scheduledEvents: scheduledEvents, setScheduledEvents: setScheduledEvents,
      auditLog: auditLog, setAuditLog: setAuditLog,
      hostApps: hostApps, setHostApps: setHostApps,
      hostTournaments: hostTournaments, setHostTournaments: setHostTournaments,
      hostBranding: hostBranding, setHostBranding: setHostBranding,
      hostAnnouncements: hostAnnouncements, setHostAnnouncements: setHostAnnouncements,
      pastClashes: pastClashes, setPastClashes: setPastClashes,
      featuredEvents: featuredEvents, setFeaturedEvents: setFeaturedEvents,
      challengeCompletions: challengeCompletions, setChallengeCompletions: setChallengeCompletions,
      pendingResults: pendingResults,
      allPendingResults: allPendingResults,

      // Auth
      currentUser: currentUser, setCurrentUser: setCurrentUser,
      isAuthLoading: isAuthLoading,
      isOffline: isOffline,
      subscriptions: subscriptions, setSubscriptions: setSubscriptions,
      authScreen: authScreen, setAuthScreen: setAuthScreen,
      cookieConsent: cookieConsent, setCookieConsent: setCookieConsent,
      showOnboarding: showOnboarding, setShowOnboarding: setShowOnboarding,
      passwordRecovery: passwordRecovery, setPasswordRecovery: setPasswordRecovery,

      // Newsletter
      newsletterEmailRef: newsletterEmailRef,
      newsletterSubmitted: newsletterSubmitted, setNewsletterSubmitted: setNewsletterSubmitted,
      clashRemindersOn: clashRemindersOn, setClashRemindersOn: setClashRemindersOn,

      // Helpers
      toast: toast,
      removeToast: removeToast,
      markAllRead: markAllRead,
      loadPlayersFromTable: loadPlayersFromTable,

      // Derived
      userTier: userTier
    };
  }, [
    screen, subRoute,
    players, isLoadingData, isAdmin,
    scrimAccess, tickerOverrides, scrimSessions,
    notifications, toasts, disputes,
    announcement, profilePlayer, comparePlayer,
    tournamentState, seasonConfig, quickClashes,
    orgSponsors, scheduledEvents, auditLog,
    hostApps, hostTournaments, hostBranding, hostAnnouncements,
    pastClashes, featuredEvents, challengeCompletions,
    currentUser, isAuthLoading, isOffline,
    subscriptions, authScreen, cookieConsent,
    showOnboarding, newsletterSubmitted, clashRemindersOn,
    userTier, pendingResults, allPendingResults,
    passwordRecovery
  ]);

  return React.createElement(AppContext.Provider, {value: value}, children);
}

export function useApp() {
  var ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
