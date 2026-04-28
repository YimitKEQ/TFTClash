import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { DEFAULT_SEASON_CONFIG, setSeasonChampion } from '../lib/constants.js';
import { getUserTier } from '../lib/tiers.js';
import { isSimulation, buildSimulationState } from '../lib/simulation.js';

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
  // Clean up legacy localStorage player cache (DB is sole source of truth now)
  try{localStorage.removeItem("tft-players");}catch(e){}

  var _players = useState([]);
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
  var setDisputes = _disputes[1];

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

  // NA region runs concurrently with EU; stored in `site_settings.tournament_state_na`.
  // Most consumers read `tournamentState` as before. NA-region screens / users can
  // pick `tournamentStateNa` explicitly via context.
  var _tournamentStateNa = useState({phase:"idle",round:1,lobbies:[],lockedLobbies:[],checkedInIds:[],registeredIds:[],waitlistIds:[],maxPlayers:24,server:"NA"});
  var tournamentStateNa = _tournamentStateNa[0];
  var setTournamentStateNa = _tournamentStateNa[1];

  var _seasonConfig = useState(DEFAULT_SEASON_CONFIG);
  var seasonConfig = _seasonConfig[0];
  var setSeasonConfig = _seasonConfig[1];

  var _quickClashes = useState([]);
  var quickClashes = _quickClashes[0];
  var setQuickClashes = _quickClashes[1];

  var _orgSponsors = useState([]);
  var orgSponsors = _orgSponsors[0];
  var setOrgSponsors = _orgSponsors[1];

  var _scheduledEvents = useState([]);
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

  var _featuredEvents = useState([]);
  var featuredEvents = _featuredEvents[0];
  var setFeaturedEvents = _featuredEvents[1];

  var _challengeCompletions = useState({});
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

  var _newsletterSubmitted = useState(false);
  var newsletterSubmitted = _newsletterSubmitted[0];
  var setNewsletterSubmitted = _newsletterSubmitted[1];

  var _clashRemindersOn = useState(function(){try{return localStorage.getItem("tft-clash-reminders")==="1";}catch(e){return false;}});
  var clashRemindersOn = _clashRemindersOn[0];
  var setClashRemindersOn = _clashRemindersOn[1];

  // ── Refs for realtime tracking ──
  var rtRef = useRef({tournament_state:false,tournament_state_na:false,quick_clashes:false,announcement:false,season_config:false,org_sponsors:false,scheduled_events:false,audit_log:false,featured_events:false,challenge_completions:false,scrim_host_access:false,scrim_access:false,scrim_data:false,ticker_overrides:false});
  var announcementInitRef = useRef(false);
  var settingsLoadedRef = useRef(false); // true once site_settings are fetched — guards sync useEffects from overwriting DB on mount
  var navSourceRef = useRef("user");

  // ── Helper functions ──

  function toast(msg,type){var id=Date.now()+Math.random();setToasts(function(ts){var next=ts.concat([{id:id,msg:msg,type:type}]);return next.length>5?next.slice(next.length-5):next;});setTimeout(function(){removeToast(id);},4000);}

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
  var playerRetryCount=useRef(0);
  function mapPlayerRow(r){
    return{
      id:r.id,name:r.username,username:r.username,
      riotId:r.riot_id||r.riot_id_eu||'',rank:r.rank||'Iron',region:r.region||null,
      riot_id_eu:r.riot_id_eu||null,riot_id_na:r.riot_id_na||null,
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
  }
  function loadPlayersFromTable(){
    if(isSimulation())return; // Simulation injects its own players
    if(!supabase.from)return;
    supabase.from('players').select('*').order('username',{ascending:true})
      .then(function(res){
        if(res.error){
          console.error('[TFT] Players load error:', res.error.message);
          // Retry up to 3 times with backoff
          if(playerRetryCount.current<3){
            playerRetryCount.current++;
            setTimeout(loadPlayersFromTable, playerRetryCount.current*2000);
          }
          return;
        }
        playerRetryCount.current=0;
        if(!res.data||!res.data.length){return;}
        var mapped=res.data.map(mapPlayerRow);
        // Set players immediately so the UI is never empty while enrichment loads
        setPlayers(mapped);
        // Enrich with game_results for detailed stats (clashHistory, streaks, etc.)
        var freshMapped=mapped;
        supabase.from('game_results').select('player_id,placement,points,round_number,tournament_id,game_number')
          .order('tournament_id',{ascending:true}).order('round_number',{ascending:true}).order('game_number',{ascending:true})
          .limit(50000)
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
                var tournamentSet={};
                hist.forEach(function(g){if(g.tournamentId)tournamentSet[g.tournamentId]=true;});
                var totalClashes=Object.keys(tournamentSet).length||hist.length;
                var curStreak=0;
                for(var ci=hist.length-1;ci>=0;ci--){
                  if(hist[ci].placement===1)curStreak++;
                  else break;
                }
                var bestStr=0, runStr=0;
                for(var bi=0;bi<hist.length;bi++){
                  if(hist[bi].placement===1){runStr++;if(runStr>bestStr)bestStr=runStr;}
                  else{runStr=0;}
                }
                var tidList=Object.keys(tournamentSet).sort();
                var attStreak=tidList.length;
                return Object.assign({},p,{
                  pts:totalPts,wins:wins,top4:top4,games:hist.length,
                  avg:avgP.toFixed(1),clashHistory:hist,
                  currentStreak:curStreak,bestStreak:bestStr,
                  attendanceStreak:attStreak,totalClashes:totalClashes
                });
              });
              setPlayers(mapped);
            }
          }).catch(function(e){ console.error('[TFT] game_results enrich error:', e); });
      }).catch(function(e){
        console.error('[TFT] Players fetch failed:', e);
        if(playerRetryCount.current<3){
          playerRetryCount.current++;
          setTimeout(loadPlayersFromTable, playerRetryCount.current*2000);
        }
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
    supabase.from("user_subscriptions").select("*").eq("user_id", currentUser.auth_user_id).limit(1).then(function(res){
      if(res.data && res.data.length){
        var map={};
        var s=res.data[0];
        map[currentUser.id]=s;
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
      var rawRegion=(u.user_metadata&&u.user_metadata.riotRegion)||(u.user_metadata&&u.user_metadata.riot_region)||(u.user_metadata&&u.user_metadata.region)||null;
      var region=null;
      if(rawRegion){
        var rUp=String(rawRegion).toUpperCase();
        if(rUp==='EUW'||rUp==='EUNE'||rUp==='TR'||rUp==='EU')region='EU';
        else if(rUp==='NA'||rUp==='LATAM'||rUp==='BR')region='NA';
      }
      return Object.assign({},u,{username:username,riotId:riotId,region:region});
    }

    function fetchAndSetCurrentUser(authUser, onDone) {
      if (!authUser) { setCurrentUser(null); if (onDone) onDone(); return; }
      supabase.rpc('get_my_player').single()
        .then(function(result) {
          if (result.data) {
            setCurrentUser(result.data);
          } else {
            if (result.error && result.error.code !== 'PGRST116') {
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
      if(session&&session.user){
        fetchAndSetCurrentUser(session.user, function(){setIsAuthLoading(false);});
      } else {
        // Dev-mode auto-login: on localhost with no session, load Levitate from DB
        var isLocal=import.meta.env.DEV&&typeof window!=='undefined'&&window.location.hostname==='localhost';
        if(isLocal&&supabase.from){
          supabase.from('players').select('*').eq('username','Levitate').single().then(function(pRes){
            if(pRes.data){
              setCurrentUser({
                id:pRes.data.id,username:pRes.data.username,email:'levitate@tftclash.gg',
                riotId:pRes.data.riot_id||'Levitate#EUW',rank:pRes.data.rank,region:pRes.data.region||'EUW',
                is_admin:false,auth_user_id:pRes.data.auth_user_id||'dev-auth-levitate'
              });
              setIsAdmin(false);
            }
            setIsAuthLoading(false);
          }).catch(function(){setIsAuthLoading(false);});
        } else {
          fetchAndSetCurrentUser(null, function(){setIsAuthLoading(false);});
        }
      }
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
      supabase.rpc('get_my_player').maybeSingle()
        .then(function(res){
          if(res.error){return;}
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
              if(ins.error.code==='23505'){loadPlayersFromTable();}
              return;
            }
            if(ins.data)setCurrentUser(Object.assign({}, ins.data, { riotId: ins.data.riot_id || '' }));
            loadPlayersFromTable();
          });
        });
    });
  },[currentUser?currentUser.id:null]);

  // ── useEffect: sync Discord identity → players.discord_user_id ──
  // Backfills the discord_user_id column when a user has linked Discord via
  // Supabase OAuth but the players row hasn't been updated yet. Required for
  // the Discord bot to look up the player by Discord ID.
  useEffect(function(){
    if(!currentUser||!currentUser.id)return;
    supabase.auth.getUser().then(function(res){
      if(!res||!res.data||!res.data.user)return;
      var ident=(res.data.user.identities||[]).find(function(i){return i.provider==='discord';});
      var discordSub=ident&&ident.identity_data&&ident.identity_data.sub;
      if(!discordSub)return;
      if(currentUser.discord_user_id===discordSub)return;
      supabase.from('players').update({discord_user_id:discordSub}).eq('auth_user_id',currentUser.id).then(function(upd){
        if(upd&&!upd.error)setCurrentUser(function(u){return u?Object.assign({},u,{discord_user_id:discordSub}):u;});
      }).catch(function(){});
    }).catch(function(){});
  },[currentUser?currentUser.id:null]);

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
      supabase.from("host_applications").select("*").order("applied_at",{ascending:false}).then(function(res){
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

  // Players are always loaded from DB -- no localStorage cache (prevents stale player lists)

  // isAdmin is derived solely from currentUser.is_admin (DB field) -- no localStorage write

  // ── useEffect: sync isAdmin from currentUser.is_admin (DB source of truth only) ──
  useEffect(function(){
    var dbAdmin = !!(currentUser && currentUser.is_admin === true);
    setIsAdmin(dbAdmin);
    // Ensure user_roles entry exists for admins so RLS policies work correctly
    if(dbAdmin && currentUser.auth_user_id && supabase.from){
      supabase.from('user_roles').upsert(
        {user_id: currentUser.auth_user_id, role: 'admin'},
        {onConflict: 'user_id,role'}
      );
    }
  }, [currentUser]);

  // Track previous user identity for any future cross-user effect cleanup
  var prevUserIdRef = useRef(currentUser && (currentUser.auth_user_id || currentUser.id));
  useEffect(function(){
    var curId = currentUser && (currentUser.auth_user_id || currentUser.id);
    if(prevUserIdRef.current !== curId){ /* identity changed */ }
    prevUserIdRef.current = curId;
  }, [currentUser]);

  // seasonConfig, quickClashes, orgSponsors, scheduledEvents are synced to site_settings DB table
  // No localStorage caching needed - DB is the single source of truth

  // hostApps now loaded from host_applications table, no localStorage sync needed

  // ── Supabase shared state - single channel for all keys ──
  useEffect(function(){

    if(!supabase.from){setIsLoadingData(false);return;}

    // Players: load from normalized players table
    loadPlayersFromTable();

    // Settings/config: load from site_settings
    supabase.from('site_settings').select('key,value')
      .in('key',['tournament_state','tournament_state_na','quick_clashes','announcement','season_config','org_sponsors','scheduled_events','audit_log','scrim_host_access','scrim_access','scrim_data','ticker_overrides','featured_events','challenge_completions'])
      .then(function(res){

        if(!res.data){setIsLoadingData(false);return;}

        res.data.forEach(function(row){
          try{
            if(row.key==='announcement'){rtRef.current.announcement=true;var aVal=row.value;try{var parsed=typeof aVal==='string'?JSON.parse(aVal):aVal;setAnnouncement(parsed&&parsed.message?parsed.message:typeof parsed==='string'?parsed:'');}catch(e){setAnnouncement(typeof aVal==='string'?aVal:'');}}
            else{
              var val=typeof row.value==='string'?JSON.parse(row.value):row.value;

              if(row.key==='tournament_state'&&val){rtRef.current.tournament_state=true;setTournamentState(val);}
              if(row.key==='tournament_state_na'&&val&&typeof val==='object'&&Object.keys(val).length>0){rtRef.current.tournament_state_na=true;setTournamentStateNa(val);}
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
          }catch(e){}
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
          // Reconcile prize pool / finale flag / rules from tournaments table — source of truth.
          supabase.from('tournaments').select('prize_pool_json,rules_text,is_finale,name,date,max_players,round_count,region')
            .eq('id',ts.dbTournamentId).single()
            .then(function(tRes){
              if(tRes.error||!tRes.data)return;
              var pool=tRes.data.prize_pool_json;
              if(typeof pool==='string'){try{pool=JSON.parse(pool);}catch(e){pool=null;}}
              setTournamentState(function(ts2){
                rtRef.current.tournament_state=true;
                var next=Object.assign({},ts2);
                if(Array.isArray(pool))next.prizePool=pool;
                if(typeof tRes.data.rules_text==='string')next.rulesOverride=tRes.data.rules_text||'';
                if(typeof tRes.data.is_finale==='boolean')next.isFinale=!!tRes.data.is_finale;
                if(typeof tRes.data.region==='string')next.region=tRes.data.region;
                return next;
              });
            }).catch(function(){});
          return ts;
        });

        setIsLoadingData(false);

        // Local simulation mode (?sim=1) - override tournament state with fake 64-player data
        if (isSimulation()) {
          var sim = buildSimulationState();
          if (sim) {
            setTournamentState(sim.tournamentState);
            setPlayers(sim.players);
            // Auto-login as Levitate so the full player experience is visible
            var simUser = sim.players.find(function(p){ return p.name === 'Levitate'; });
            if (simUser) {
              setCurrentUser({
                id: simUser.id,
                username: simUser.name,
                email: 'levitate@tftclash.gg',
                riotId: simUser.riotId || 'Levitate#EUW',
                rank: simUser.rank,
                region: simUser.region || 'EUW',
                is_admin: false,
                auth_user_id: 'sim-auth-levitate'
              });
              setIsAdmin(false);
            }
          }
        }

      }).catch(function(){ setIsLoadingData(false); });

    // realtime - push changes to all browsers instantly
    var ch=supabase.channel('shared_state')
      .on('postgres_changes',{event:'*',schema:'public',table:'site_settings'},function(payload){
        try{
          var key=payload.new&&payload.new.key;
          var raw=payload.new&&payload.new.value;
          if(!key)return;

          if(key==='announcement'){rtRef.current.announcement=true;try{var parsed=typeof raw==='string'?JSON.parse(raw):raw;setAnnouncement(parsed&&parsed.message?parsed.message:typeof parsed==='string'?parsed:'');}catch(e){setAnnouncement(typeof raw==='string'?raw:'');}return;}

          var val=typeof raw==='string'?JSON.parse(raw||'null'):raw;
          if(!val)return;

          if(key==='tournament_state'){rtRef.current.tournament_state=true;setTournamentState(val);}
          if(key==='tournament_state_na'){rtRef.current.tournament_state_na=true;setTournamentStateNa(val);}
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
        }catch(e){}
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
        setTournamentState(function(ts){
          var rids=new Set((ts.registeredIds||[]).map(String));
          var cids=new Set((ts.checkedInIds||[]).map(String));
          if(row.status==='checked_in'){
            cids.add(pid); rids.add(pid);
          } else if(row.status==='registered'){
            rids.add(pid); cids.delete(pid);
          } else {
            // dropped, waitlisted, or any other status - remove from both
            rids.delete(pid); cids.delete(pid);
          }
          return Object.assign({},ts,{registeredIds:Array.from(rids),checkedInIds:Array.from(cids)});
        });
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
    if(isSimulation())return; // Never sync simulation state to DB
    if(rtRef.current.tournament_state){rtRef.current.tournament_state=false;return;}
    if(supabase.from&&isAdmin){
      // Route NA-server states to the NA slot so EU and NA can run concurrently.
      var key=(tournamentState&&tournamentState.server==='NA')?'tournament_state_na':'tournament_state';
      supabase.from('site_settings').upsert({key:key,value:JSON.stringify(tournamentState),updated_at:new Date().toISOString()})
        .then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
    }
  },[tournamentState]);

  useEffect(function(){
    if(isSimulation())return;
    if(rtRef.current.tournament_state_na){rtRef.current.tournament_state_na=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'tournament_state_na',value:JSON.stringify(tournamentStateNa),updated_at:new Date().toISOString()})
      .then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[tournamentStateNa]);

  // ── Debug: expose state to window for diagnostics (DEV ONLY — never in production) ──
  useEffect(function(){
    if(typeof window==='undefined')return;
    if(!import.meta.env.DEV)return;
    window.__tft={
      currentUser:currentUser,
      players:players,
      tournamentState:tournamentState,
      isAdmin:isAdmin
    };
  },[currentUser,players,tournamentState,isAdmin]);

  // ── Auto-advance phase based on clashTimestamp (admin only, runs every 30s) ──
  useEffect(function(){
    if(!isAdmin)return;
    if(isSimulation())return;
    function tick(){
      var ts=tournamentState;
      if(!ts||!ts.clashTimestamp)return;
      var target=new Date(ts.clashTimestamp).getTime();
      if(isNaN(target))return;
      var now=Date.now();
      var checkinWindow=parseInt(ts.checkinWindowMins||30,10)*60000;
      // Registration → Check-in: starts checkinWindow before clash time
      if(ts.phase==='registration'&&now>=target-checkinWindow&&now<target){
        setTournamentState(function(s){return Object.assign({},s,{phase:'checkin'});});
        var tId=ts.activeTournamentId||ts.dbTournamentId;
        if(tId)supabase.from('tournaments').update({phase:'check_in'}).eq('id',tId).then(function(){}).catch(function(){});
        toast('Auto: Check-in opened','info');
      }
      // Check-in → In progress: at clash time
      else if(ts.phase==='checkin'&&now>=target){
        setTournamentState(function(s){return Object.assign({},s,{phase:'inprogress'});});
        var tId2=ts.activeTournamentId||ts.dbTournamentId;
        if(tId2)supabase.from('tournaments').update({phase:'in_progress'}).eq('id',tId2).then(function(){}).catch(function(){});
        toast('Auto: Tournament started','info');
      }
    }
    tick();
    var iv=setInterval(tick,30000);
    return function(){clearInterval(iv);};
  },[tournamentState&&tournamentState.clashTimestamp,tournamentState&&tournamentState.phase,isAdmin]);

  // ── Auto-mark no-shows when clash flips to complete ──
  // For each player who was checked_in but never appeared in game_results,
  // bump their dnp_count. Only runs once per phase transition (admin only).
  var lastNoShowTidRef=useRef(null);
  useEffect(function(){
    if(!isAdmin)return;
    if(isSimulation())return;
    var ts=tournamentState;
    if(!ts||ts.phase!=='complete')return;
    var tId=ts.activeTournamentId||ts.dbTournamentId;
    if(!tId)return;
    if(lastNoShowTidRef.current===tId)return;
    lastNoShowTidRef.current=tId;
    supabase.from('registrations').select('player_id,status').eq('tournament_id',tId).then(function(regRes){
      if(!regRes||regRes.error||!regRes.data)return;
      var checkedIn=regRes.data.filter(function(r){return r.status==='checked_in';}).map(function(r){return r.player_id;});
      if(checkedIn.length===0)return;
      supabase.from('game_results').select('player_id').eq('tournament_id',tId).then(function(grRes){
        if(!grRes||grRes.error||!grRes.data)return;
        var played=new Set(grRes.data.map(function(r){return r.player_id;}));
        var noShows=checkedIn.filter(function(pid){return !played.has(pid);});
        if(noShows.length===0)return;
        supabase.rpc('increment_dnp_for_players',{player_ids:noShows}).then(function(r){
          if(r&&r.error){
            // Fallback if RPC doesn't exist: do per-row update
            noShows.forEach(function(pid){
              supabase.from('players').select('dnp_count').eq('id',pid).single().then(function(pr){
                if(pr&&pr.data)supabase.from('players').update({dnp_count:(pr.data.dnp_count||0)+1}).eq('id',pid).then(function(){});
              });
            });
          }
          toast('Marked '+noShows.length+' no-show'+(noShows.length===1?'':'s'),'info');
        }).catch(function(){});
      });
    });
  },[tournamentState&&tournamentState.phase,tournamentState&&(tournamentState.activeTournamentId||tournamentState.dbTournamentId)]);

  // ── Discord webhook on phase change ──
  var lastPhaseRef=useRef(null);
  useEffect(function(){
    if(!isAdmin)return;
    if(isSimulation())return;
    var phase=tournamentState&&tournamentState.phase;
    if(!phase)return;
    if(lastPhaseRef.current===null){lastPhaseRef.current=phase;return;}
    if(lastPhaseRef.current===phase)return;
    lastPhaseRef.current=phase;
    if(seasonConfig&&seasonConfig.discordNotifications===false)return;
    var clashName=(tournamentState.clashName)||'TFT Clash';
    var clashTime=tournamentState.clashTimestamp?new Date(tournamentState.clashTimestamp).toLocaleString():'TBD';
    var phaseLabels={registration:'**Registration is OPEN**',checkin:'**Check-in is now LIVE**',inprogress:'**Tournament has STARTED**',complete:'**Tournament COMPLETE**'};
    var content=(phaseLabels[phase]||('Phase: '+phase))+' for '+clashName+'\nClash time: '+clashTime;
    supabase.auth.getSession().then(function(s){
      var token=s&&s.data&&s.data.session&&s.data.session.access_token;
      if(!token)return;
      fetch('/api/discord-notify',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({content:content})}).catch(function(){});
    });
  },[tournamentState&&tournamentState.phase]);

  useEffect(function(){
    if(rtRef.current.quick_clashes){rtRef.current.quick_clashes=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'quick_clashes',value:JSON.stringify(quickClashes),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[quickClashes]);

  useEffect(function(){
    if(!announcementInitRef.current)return;
    if(rtRef.current.announcement){rtRef.current.announcement=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'announcement',value:JSON.stringify(announcement),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[announcement]);

  useEffect(function(){
    if(rtRef.current.season_config){rtRef.current.season_config=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'season_config',value:JSON.stringify(seasonConfig),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[seasonConfig]);

  useEffect(function(){
    if(rtRef.current.org_sponsors){rtRef.current.org_sponsors=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'org_sponsors',value:JSON.stringify(orgSponsors),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[orgSponsors]);

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.scheduled_events){rtRef.current.scheduled_events=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'scheduled_events',value:JSON.stringify(scheduledEvents),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[scheduledEvents]);

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.audit_log){rtRef.current.audit_log=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'audit_log',value:JSON.stringify(auditLog),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[auditLog]);

  // hostApps now managed via host_applications table, no site_settings sync

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.scrim_host_access){rtRef.current.scrim_host_access=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'scrim_host_access',value:JSON.stringify(scrimHostAccess),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[scrimHostAccess]);

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.scrim_access){rtRef.current.scrim_access=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'scrim_access',value:JSON.stringify(scrimAccess),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[scrimAccess]);

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.scrim_data){rtRef.current.scrim_data=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'scrim_data',value:JSON.stringify(scrimSessions),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[scrimSessions]);

  useEffect(function(){
    if(!settingsLoadedRef.current)return;
    if(rtRef.current.ticker_overrides){rtRef.current.ticker_overrides=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'ticker_overrides',value:JSON.stringify(tickerOverrides),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[tickerOverrides]);

  // hostTournaments, hostBranding, hostAnnouncements now managed via DB tables, no site_settings sync

  useEffect(function(){
    if(rtRef.current.featured_events){rtRef.current.featured_events=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'featured_events',value:JSON.stringify(featuredEvents),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[featuredEvents]);

  useEffect(function(){
    if(rtRef.current.challenge_completions){rtRef.current.challenge_completions=false;return;}
    if(supabase.from&&isAdmin)supabase.from('site_settings').upsert({key:'challenge_completions',value:JSON.stringify(challengeCompletions),updated_at:new Date().toISOString()}).then(function(res){if(res&&res.error)toast('Settings sync failed','error');});
  },[challengeCompletions]);

  // ── Load past clashes from tournament_results + tournaments tables ──
  var playersLoadedCount=players.length;
  useEffect(function(){
    if(!supabase.from||!playersLoadedCount)return;
    supabase.from('tournaments').select('id,name,date').eq('phase','complete').order('date',{ascending:false}).limit(50)
      .then(function(res){
        if(res.error){return;}
        if(!res.data||!res.data.length){setPastClashes([]);return;}
        var tIds=res.data.map(function(t){return t.id;});
        supabase.from('tournament_results').select('tournament_id,player_id,final_placement,total_points')
          .in('tournament_id',tIds).order('final_placement',{ascending:true})
          .then(function(rRes){
            if(rRes.error){return;}
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
  },[currentUser&&currentUser.id,tournamentState.dbTournamentId]);

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
  },[currentUser?currentUser.id:null]);

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
  },[isAdmin,tournamentState.dbTournamentId]);

  // ── Load + subscribe to lobbies for the active tournament/round ──
  // Hydrates tournamentState.lobbies so DashboardScreen and BroadcastOverlay
  // can show the player's lobby roster, lobby_code, and submission progress.
  useEffect(function(){
    var tid=tournamentState&&tournamentState.dbTournamentId;
    var rd=(tournamentState&&tournamentState.round)||1;
    if(!tid||!supabase.from)return;

    function normalize(rows){
      return (rows||[]).map(function(row){
        return{
          lobby_number:row.lobby_number,
          num:row.lobby_number,
          number:row.lobby_number,
          playerIds:row.player_ids||[],
          lobby_code:row.lobby_code||null,
          status:row.status||'pending',
          host_player_id:row.host_player_id||null,
          id:row.id
        };
      }).sort(function(a,b){return (a.lobby_number||0)-(b.lobby_number||0);});
    }

    function hydrate(rows){
      var normalized=normalize(rows);
      setTournamentState(function(ts){
        var prev=(ts&&ts.lobbies)||[];
        if(JSON.stringify(prev)===JSON.stringify(normalized))return ts;
        return Object.assign({},ts,{lobbies:normalized});
      });
    }

    supabase.from('lobbies')
      .select('*')
      .eq('tournament_id',tid)
      .eq('round_number',rd)
      .then(function(res){
        if(res&&res.data)hydrate(res.data);
      });

    var lobChannel=supabase
      .channel('lobbies-realtime-'+tid+'-'+rd)
      .on('postgres_changes',{
        event:'*',
        schema:'public',
        table:'lobbies',
        filter:'tournament_id=eq.'+tid
      },function(){
        supabase.from('lobbies')
          .select('*')
          .eq('tournament_id',tid)
          .eq('round_number',rd)
          .then(function(res){
            if(res&&res.data)hydrate(res.data);
          });
      })
      .subscribe();

    return function(){supabase.removeChannel(lobChannel);};
  },[tournamentState&&tournamentState.dbTournamentId,tournamentState&&tournamentState.round]);

  // ── Load pending disputes for admin badge ──
  useEffect(function(){
    if(!isAdmin||!supabase.from)return;
    supabase.from('disputes')
      .select('*')
      .in('status',['pending','open'])
      .order('created_at',{ascending:false})
      .limit(50)
      .then(function(res){
        if(res.data)setDisputes(res.data);
      });
  },[isAdmin]);

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
      isAdmin: isAdmin,
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
      tournamentStateNa: tournamentStateNa, setTournamentStateNa: setTournamentStateNa,
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
    scrimAccess, scrimHostAccess, tickerOverrides, scrimSessions,
    notifications, toasts, disputes,
    announcement, profilePlayer, comparePlayer,
    tournamentState, tournamentStateNa, seasonConfig, quickClashes,
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
