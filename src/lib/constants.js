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

export const HOMIES_IDS = [];

export const SEED = [];

export const PAST_CLASHES = [];

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
