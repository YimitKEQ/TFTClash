// ─── DATA VERSION  -  bump to bust stale localStorage ─────────────────────────
export var DATA_VERSION = 2;

// ─── DEBUG LOGGING ─────────────────────────────────────────────────────────────
export var TFT_DEBUG = typeof window !== "undefined" && window.location.search.indexOf("debug=1") > -1;
export function dbg() { if (TFT_DEBUG) console.log.apply(console, arguments); }

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

export const RANKS = ["Iron","Bronze","Silver","Gold","Platinum","Emerald","Diamond","Master","Grandmaster","Challenger"];

export const RCOLS = {Iron:"#8C7B6B",Bronze:"#CD7F32",Silver:"#A8B2CC",Gold:"#E8A838",Platinum:"#4ECDC4",Emerald:"#52C47C",Diamond:"#6EA8E0",Master:"#9B72CF",Grandmaster:"#E85B5B",Challenger:"#FFD700"};

export const REGIONS = ["EUW","EUNE","NA","KR","OCE","BR","JP","TR","LATAM"];

// Fixed scoring - not configurable
export const PTS = {1:8,2:7,3:6,4:5,5:4,6:3,7:2,8:1};

export const DEFAULT_SEASON_CONFIG = {
  dropWeeks: 0,
  finalBoost: 1.0,
  finaleClashes: 2,
  attendanceBonus: false,
  comebackBonus: false,
  seasonName: "Season 1",
  seasonTag: "S1",
  defaultClashSize: 126,
};

export const TIERS = [{label:"S",min:850,col:"#FFD700"},{label:"A",min:650,col:"#52C47C"},{label:"B",min:450,col:"#4ECDC4"},{label:"C",min:200,col:"#9B72CF"},{label:"D",min:0,col:"#BECBD9"}];

// ─── PLATFORM RANKING SYSTEM ─────────────────────────────────────────────────

export const CLASH_RANKS = [
  {id:"iron",       name:"Iron",        icon:"gear-fill",  color:"#BECBD9", minXp:0,    maxXp:200},
  {id:"bronze",     name:"Bronze",      icon:"shield-fill",  color:"#CD7F32", minXp:200,  maxXp:500},
  {id:"silver",     name:"Silver",      icon:"shield-fill",  color:"#C0C0C0", minXp:500,  maxXp:900},
  {id:"gold",       name:"Gold",        icon:"shield-fill",  color:"#E8A838", minXp:900,  maxXp:1400},
  {id:"platinum",   name:"Platinum",    icon:"diamond-half",  color:"#4ECDC4", minXp:1400, maxXp:2000},
  {id:"diamond",    name:"Diamond",     icon:"gem",  color:"#9B72CF", minXp:2000, maxXp:2800},
  {id:"master",     name:"Master",      icon:"stars",  color:"#EAB308", minXp:2800, maxXp:3800},
  {id:"grandmaster",name:"Grandmaster", icon:"eye-fill",  color:"#F87171", minXp:3800, maxXp:5000},
  {id:"challenger", name:"Clash Challenger",icon:"trophy-fill",color:"#E8A838",minXp:5000,maxXp:99999},
];

// XP rewards per action
export const XP_REWARDS = {
  play_game:25,       // just playing
  top4:15,            // bonus for top 4
  win:40,             // 1st place
  top2:25,            // 2nd place bonus
  clutch:20,          // clutch win
  streak_3:30,        // 3-win streak
  challenge_daily:50, // daily challenge
  challenge_weekly:120,// weekly challenge
  season_pts_100:60,  // every 100 season pts
};

// ─── TIER FEATURES ──────────────────────────────────────────────────────────

export var TIER_FEATURES = {
  free: {
    compete: true,
    basicStats: true,
    basicProfile: true,
    viewResults: true,
    currentSeasonHistory: true,
    enhancedStats: false,
    proBadge: false,
    priorityRegistration: false,
    extendedHistory: false,
    customBanner: false,
    comparisonTool: false,
    emailDigest: false,
    createTournaments: false,
    brandedPages: false,
    hostDashboard: false,
    customRules: false,
    apiAccess: false
  },
  pro: {
    compete: true,
    basicStats: true,
    basicProfile: true,
    viewResults: true,
    currentSeasonHistory: true,
    enhancedStats: true,
    proBadge: true,
    priorityRegistration: true,
    extendedHistory: true,
    customBanner: true,
    comparisonTool: true,
    emailDigest: true,
    createTournaments: false,
    brandedPages: false,
    hostDashboard: false,
    customRules: false,
    apiAccess: false
  },
  host: {
    compete: true,
    basicStats: true,
    basicProfile: true,
    viewResults: true,
    currentSeasonHistory: true,
    enhancedStats: true,
    proBadge: true,
    priorityRegistration: true,
    extendedHistory: true,
    customBanner: true,
    comparisonTool: true,
    emailDigest: true,
    createTournaments: true,
    brandedPages: true,
    hostDashboard: true,
    customRules: true,
    apiAccess: true
  }
};

// ─── SEED DATA ────────────────────────────────────────────────────────────────

export const HOMIES_IDS = [1,2,3,4,5,6,7,8,9];

export const SEED = [
  {id:1,name:"Levitate",   rank:"Challenger",  region:"EUW",pts:1024,wins:16,top4:38,games:56,riot_id_eu:"Levitate#EUW"},
  {id:2,name:"Zounderkite",rank:"Grandmaster", region:"EUW",pts:896, wins:13,top4:33,games:52,riot_id_eu:"Zounderkite#EUW"},
  {id:3,name:"Uri",        rank:"Master",      region:"EUW",pts:780, wins:11,top4:28,games:48,riot_id_eu:"Uri#EUW"},
  {id:4,name:"BingBing",   rank:"Master",      region:"EUW",pts:720, wins:10,top4:26,games:46,riot_id_eu:"BingBing#EUW"},
  {id:5,name:"Wiwi",       rank:"Diamond",     region:"EUW",pts:610, wins:8, top4:22,games:44,riot_id_eu:"Wiwi#EUW"},
  {id:6,name:"Ole",        rank:"Diamond",     region:"EUW",pts:540, wins:7, top4:20,games:40,riot_id_eu:"Ole#EUW"},
  {id:7,name:"Sybor",      rank:"Platinum",    region:"EUW",pts:430, wins:5, top4:16,games:36,riot_id_eu:"Sybor#EUW"},
  {id:8,name:"Ivdim",      rank:"Platinum",    region:"EUW",pts:380, wins:4, top4:14,games:32,riot_id_eu:"Ivdim#EUW"},
  {id:9,name:"Vlad",       rank:"Gold",        region:"EUW",pts:290, wins:3, top4:10,games:28,riot_id_eu:"Vlad#EUW"},
  {id:10,name:"Dishsoap",  rank:"Grandmaster", region:"EUW",pts:260, wins:2, top4:9, games:24},
  {id:11,name:"k3soju",    rank:"Challenger",  region:"NA", pts:240, wins:2, top4:8, games:22},
  {id:12,name:"Setsuko",   rank:"Master",      region:"EUW",pts:210, wins:2, top4:7, games:20},
  {id:13,name:"Mortdog",   rank:"Diamond",     region:"NA", pts:190, wins:1, top4:6, games:18},
  {id:14,name:"Robinsongz",rank:"Master",      region:"NA", pts:170, wins:1, top4:6, games:16},
  {id:15,name:"Wrainbash", rank:"Diamond",     region:"EUW",pts:150, wins:1, top4:5, games:14},
  {id:16,name:"BunnyMuffins",rank:"Master",    region:"NA", pts:130, wins:1, top4:5, games:12},
  {id:17,name:"Frodan",    rank:"Diamond",     region:"NA", pts:110, wins:0, top4:4, games:10},
  {id:18,name:"NightShark",rank:"Platinum",    region:"EUW",pts:90,  wins:0, top4:3, games:8},
  {id:19,name:"CrystalFox",rank:"Platinum",    region:"EUW",pts:70,  wins:0, top4:2, games:6},
  {id:20,name:"VoidWalker",rank:"Gold",        region:"EUW",pts:50,  wins:0, top4:2, games:4},
  {id:21,name:"StarForge", rank:"Gold",        region:"NA", pts:40,  wins:0, top4:1, games:4},
  {id:22,name:"IronMask",  rank:"Silver",      region:"EUW",pts:30,  wins:0, top4:1, games:4},
  {id:23,name:"DawnBreaker",rank:"Silver",     region:"EUW",pts:20,  wins:0, top4:0, games:2},
  {id:24,name:"GhostRider",rank:"Bronze",      region:"EUW",pts:10,  wins:0, top4:0, games:2},
];

export const PAST_CLASHES = [
  {id:"c7",name:"Clash #7",date:"2026-03-22",season:"S1",players:24,lobbies:3,champion:"Levitate",
    top3:["Levitate","Zounderkite","Uri"],
    top8:[{name:"Levitate",pts:8},{name:"Zounderkite",pts:7},{name:"Uri",pts:6},{name:"BingBing",pts:5},{name:"Wiwi",pts:4},{name:"Ole",pts:3},{name:"Sybor",pts:2},{name:"Ivdim",pts:1}]},
  {id:"c6",name:"Clash #6",date:"2026-03-15",season:"S1",players:24,lobbies:3,champion:"BingBing",
    top3:["BingBing","Levitate","Wiwi"],
    top8:[{name:"BingBing",pts:8},{name:"Levitate",pts:7},{name:"Wiwi",pts:6},{name:"Uri",pts:5},{name:"Zounderkite",pts:4},{name:"Ole",pts:3},{name:"Vlad",pts:2},{name:"Sybor",pts:1}]},
  {id:"c5",name:"Clash #5",date:"2026-03-08",season:"S1",players:24,lobbies:3,champion:"Zounderkite",
    top3:["Zounderkite","Ole","Levitate"],
    top8:[{name:"Zounderkite",pts:8},{name:"Ole",pts:7},{name:"Levitate",pts:6},{name:"BingBing",pts:5},{name:"Ivdim",pts:4},{name:"Wiwi",pts:3},{name:"Uri",pts:2},{name:"Vlad",pts:1}]},
  {id:"c4",name:"Clash #4",date:"2026-03-01",season:"S1",players:24,lobbies:3,champion:"Levitate",
    top3:["Levitate","Sybor","Uri"],
    top8:[{name:"Levitate",pts:8},{name:"Sybor",pts:7},{name:"Uri",pts:6},{name:"Zounderkite",pts:5},{name:"Wiwi",pts:4},{name:"BingBing",pts:3},{name:"Ole",pts:2},{name:"Ivdim",pts:1}]},
  {id:"c3",name:"Clash #3",date:"2026-02-22",season:"S1",players:24,lobbies:3,champion:"Uri",
    top3:["Uri","Levitate","BingBing"],
    top8:[{name:"Uri",pts:8},{name:"Levitate",pts:7},{name:"BingBing",pts:6},{name:"Wiwi",pts:5},{name:"Zounderkite",pts:4},{name:"Sybor",pts:3},{name:"Ole",pts:2},{name:"Vlad",pts:1}]},
  {id:"c2",name:"Clash #2",date:"2026-02-15",season:"S1",players:24,lobbies:3,champion:"Wiwi",
    top3:["Wiwi","Zounderkite","Ivdim"],
    top8:[{name:"Wiwi",pts:8},{name:"Zounderkite",pts:7},{name:"Ivdim",pts:6},{name:"Levitate",pts:5},{name:"Uri",pts:4},{name:"BingBing",pts:3},{name:"Ole",pts:2},{name:"Sybor",pts:1}]},
  {id:"c1",name:"Clash #1",date:"2026-02-08",season:"S1",players:24,lobbies:3,champion:"Levitate",
    top3:["Levitate","Ole","Vlad"],
    top8:[{name:"Levitate",pts:8},{name:"Ole",pts:7},{name:"Vlad",pts:6},{name:"Uri",pts:5},{name:"Zounderkite",pts:4},{name:"BingBing",pts:3},{name:"Wiwi",pts:2},{name:"Ivdim",pts:1}]},
];

// ─── CHAMPION SYSTEM ─────────────────────────────────────────────────────────

// Mutable season champion - use getter/setter since ES module bindings are read-only from importers
var _seasonChampion = null;
export function getSeasonChampion() { return _seasonChampion; }
export function setSeasonChampion(val) { _seasonChampion = val; }

// ─── PREMIUM TIERS ────────────────────────────────────────────────────────────

export const PREMIUM_TIERS = [
  {
    id:"free", name:"Player", price:"\u20AC0", period:"forever", color:"#BECBD9",
    desc:"Compete in every weekly clash. Always free.",
    features:["Enter every TFT Clash event","Full season stats & leaderboard","Personal profile with career history","Achievements, milestones & XP ranks","Hall of Fame & rival tracking","Discord results sharing"],
    cta:"You're In", ctaV:"dark",
  },
  {
    id:"pro", name:"Pro", price:"\u20AC4.99", period:"/ month", color:"#E8A838", popular:true,
    desc:"For players who take the season seriously.",
    features:["Everything in Player","Auto check-in (never miss a clash)","Custom profile: avatar, banner & bio styling","Pro badge on profile & leaderboard","Season Recap card (shareable PNG)","Extended stat history - all seasons","Exclusive Discord channels (tactics, meta, pro-only)","Early access to new features"],
    cta:"Go Pro", ctaV:"primary",
  },
  {
    id:"org", name:"Host", price:"\u20AC24.99", period:"/ month", color:"#9B72CF",
    desc:"Run your own TFT Clash circuit on our platform.",
    features:["Everything in Pro","Create & manage your own clash events","Custom branding on tournament pages","Private / invite-only clashes","Advanced admin dashboard","CSV data export","Dedicated support"],
    cta:"Apply to Host", ctaV:"purple",
  },
];

// ─── RULES SECTIONS ──────────────────────────────────────────────────────────

export var RULES_SECTIONS = [
  {id:"format",title:"Tournament Format",icon:"tournament",content:"Weekly Saturday clashes with 3-5 games per session. 8 players per lobby. Standard EMEA scoring."},
  {id:"points",title:"Points System",icon:"chart-bar",content:"1st: 8 pts, 2nd: 7 pts, 3rd: 6 pts, 4th: 5 pts, 5th: 4 pts, 6th: 3 pts, 7th: 2 pts, 8th: 1 pt",isPointsTable:true},
  {id:"tiebreakers",title:"Tiebreakers",icon:"arrows-sort",content:"1. Total tournament points. 2. Wins + top 4s (wins count twice). 3. Most of each placement (1st, then 2nd, then 3rd...). 4. Most recent game finish."},
  {id:"registration",title:"Registration and Check-in",icon:"clipboard-check",content:"Register anytime before the clash. Check-in opens 60 minutes before start and closes at start time. No-shows lose their spot to the next waitlisted player."},
  {id:"results",title:"Result Submission",icon:"send",content:"Any player in a lobby can submit results. A different player must confirm. If disputed, an admin reviews. Admin can always override."},
  {id:"swiss",title:"Swiss Reseeding",icon:"refresh",content:"When Swiss mode is enabled, lobbies are reseeded after every 2 games. Players are sorted by cumulative points and snake-seeded into new lobbies."},
  {id:"conduct",title:"Code of Conduct",icon:"shield",content:"Respectful behavior is required. Intentional disconnects, collusion, or abusive communication may result in warnings, temporary bans, or permanent removal."},
  {id:"disputes",title:"Disputes and Appeals",icon:"gavel",content:"Click Dispute on any result submission to flag it for admin review. Admins will review within 24 hours. Decisions are final."}
];

// ─── FAQ DATA ────────────────────────────────────────────────────────────────

export var FAQ_DATA = [
  {cat:"Getting Started",icon:"rocket",items:[
    {q:"How do I join a clash?",a:"Navigate to the Clash screen and click Register. Check-in opens 60 minutes before the clash starts."},
    {q:"Is it free to play?",a:"Yes, competing is always free. Pro and Host tiers unlock extra features like advanced stats, broadcast mode, and tournament hosting."},
    {q:"Do I need a Riot account?",a:"You need a TFT Clash account. Linking your Riot ID is optional but recommended for verification."}
  ]},
  {cat:"During a Clash",icon:"swords",items:[
    {q:"How are lobbies assigned?",a:"Players are distributed into 8-player lobbies. With Swiss mode, lobbies reseed after every 2 games based on cumulative points."},
    {q:"How do I submit results?",a:"After each game, any player in the lobby can submit placements. Another player must confirm them."},
    {q:"What if results are wrong?",a:"Click Dispute on the result. An admin will review within 24 hours."}
  ]},
  {cat:"Scoring and Rankings",icon:"chart-bar",items:[
    {q:"How does scoring work?",a:"Standard EMEA scoring: 1st gets 8 pts, 2nd gets 7 pts, down to 8th getting 1 pt. Points accumulate across all games in a clash."},
    {q:"How are tiebreakers resolved?",a:"Total points first, then wins + top 4s (wins count double), then most of each placement starting from 1st, then most recent finish."},
    {q:"What are seasons?",a:"Seasons run for a set period. Points reset each season. Season champions are enshrined in the Hall of Fame."}
  ]},
  {cat:"Pro and Host Tiers",icon:"crown",items:[
    {q:"What does Pro unlock?",a:"Advanced stats, head-to-head comparisons, broadcast mode, custom profile banners, and priority support."},
    {q:"What does Host unlock?",a:"Create and brand your own tournaments, custom landing pages, featured event placement, and full analytics dashboard."},
    {q:"Can I cancel anytime?",a:"Yes. Your tier remains active until the end of the billing period."}
  ]}
];
