# Content & Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform TFT Clash from a structural prototype into a polished, functional competitive platform with personalized dashboards, working feature gating, database-backed scrims, and broadcast mode.

**Architecture:** All changes happen in `src/App.jsx` (single-file React monolith, currently 18,777 lines). New Supabase tables are created via migrations. Edge Functions handle server-side concerns (email, future payment webhooks). Every UI element must have working backend functionality.

**Tech Stack:** React (createElement + JSX hybrid), Supabase (Postgres + Auth + Realtime + Edge Functions + Storage), CSS-in-JS via inline styles + GCSS template literal.

**Spec:** `docs/superpowers/specs/2026-03-21-content-visual-overhaul-design.md`

**Critical Rules (from CLAUDE.md):**
- NO IIFEs in JSX
- Do NOT touch GCSS template literal structure (lines 1091-1807)
- Brace balance must stay at 0 after every edit
- No backtick string literals inside JS functions (use string concatenation)
- No named function components defined inside another component's body
- ZERO em dashes or en dashes in any user-facing string

---

## File Map

All tasks modify a single file unless noted:

| File | Role |
|------|------|
| `src/App.jsx` | All UI components, routing, state management |
| `supabase/migrations/*.sql` | Database schema changes |
| `supabase/functions/*/index.ts` | Edge Functions (email digest, future payment webhooks) |

---

## Phase 1: Core Dashboard & Identity (Tasks 1-8)

The highest-impact changes. After this phase: logged-in users see a personalized dashboard, standings have tier lines and sparklines, profiles show placement distributions and trajectory charts.

---

### Task 1: Database Migrations for New Tables

**Files:**
- Create: `supabase/migrations/20260321_content_overhaul.sql`

**Context:** The spec defines 10+ new tables and extensions to existing tables. These must exist before any UI work begins. Reference spec Section 23.

- [ ] **Step 1: Create the migration file with all new tables**

```sql
-- Activity feed for home dashboard
CREATE TABLE IF NOT EXISTS activity_feed (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  player_id BIGINT REFERENCES players(id),
  detail_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scrim system
CREATE TABLE IF NOT EXISTS scrims (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  notes TEXT,
  tag TEXT
);

CREATE TABLE IF NOT EXISTS scrim_players (
  scrim_id BIGINT REFERENCES scrims(id) ON DELETE CASCADE,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (scrim_id, player_id)
);

CREATE TABLE IF NOT EXISTS scrim_games (
  id BIGSERIAL PRIMARY KEY,
  scrim_id BIGINT REFERENCES scrims(id) ON DELETE CASCADE,
  game_number INT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrim_results (
  id BIGSERIAL PRIMARY KEY,
  scrim_game_id BIGINT REFERENCES scrim_games(id) ON DELETE CASCADE,
  player_id BIGINT REFERENCES players(id),
  placement INT NOT NULL,
  points INT NOT NULL
);

-- Subscription/pricing (provider-agnostic)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free','pro','host')),
  provider TEXT DEFAULT 'manual',
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  current_period_end TIMESTAMPTZ
);

-- Achievements
CREATE TABLE IF NOT EXISTS player_achievements (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  progress JSONB DEFAULT '{}',
  UNIQUE(player_id, achievement_id)
);

-- Challenges
CREATE TABLE IF NOT EXISTS challenges (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  criteria_json JSONB NOT NULL,
  start_date DATE,
  end_date DATE,
  reward TEXT
);

CREATE TABLE IF NOT EXISTS player_challenges (
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  challenge_id BIGINT REFERENCES challenges(id) ON DELETE CASCADE,
  progress JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (player_id, challenge_id)
);

-- Milestones
CREATE TABLE IF NOT EXISTS player_milestones (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT REFERENCES players(id) ON DELETE CASCADE,
  milestone_id TEXT NOT NULL,
  progress JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  UNIQUE(player_id, milestone_id)
);

-- Host system
CREATE TABLE IF NOT EXISTS host_applications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  community_name TEXT NOT NULL,
  discord_link TEXT,
  player_count TEXT,
  experience TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS host_profiles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  community_name TEXT NOT NULL,
  logo_url TEXT,
  accent_color TEXT DEFAULT '#9B72CF',
  banner_url TEXT,
  status TEXT DEFAULT 'active'
);

-- Point adjustments audit trail
CREATE TABLE IF NOT EXISTS point_adjustments (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT REFERENCES players(id),
  admin_id UUID REFERENCES auth.users(id),
  amount INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gear items
CREATE TABLE IF NOT EXISTS gear_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price TEXT,
  external_url TEXT,
  category TEXT DEFAULT 'general',
  sort_order INT DEFAULT 0
);

-- Seasons
CREATE TABLE IF NOT EXISTS seasons (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  champion_id BIGINT REFERENCES players(id),
  config_json JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active'
);

-- Player penalties
CREATE TABLE IF NOT EXISTS player_penalties (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT REFERENCES players(id),
  admin_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  type TEXT DEFAULT 'ticker',
  message TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  detail_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_id BIGINT REFERENCES players(id),
  referred_id BIGINT REFERENCES players(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend existing tables (safe ADD COLUMN IF NOT EXISTS)
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_clash_rank INT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS consistency_grade TEXT;

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES auth.users(id);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS branding_json JSONB DEFAULT '{}';

-- Extend user_profiles for onboarding, social, notifications, tier
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_step INT DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS social_twitter TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS social_discord TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS social_twitch TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tier_override TEXT;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` or apply via Supabase dashboard.
Expected: All tables created, no errors.

- [ ] **Step 3: Verify tables exist**

Run: `npx supabase db dump --schema public | grep "CREATE TABLE"` or check via Supabase dashboard.
Expected: All new tables listed.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260321_content_overhaul.sql
git commit -m "feat: add database tables for content overhaul (scrims, subscriptions, achievements, etc.)"
```

---

### Task 2: Tier System and Feature Gating Helper

**Files:**
- Modify: `src/App.jsx` (add near other helper functions, around line 370)

**Context:** The `getUserTier()` function and `TIER_FEATURES` constant power all feature gating. This must exist before any Pro/Host gated features are built. Spec Section 11.

- [ ] **Step 1: Add TIER_FEATURES constant and getUserTier helper**

Add after the `getStats()` function (around line 372). This goes in the constants/helpers section at the top of the file.

```javascript
var TIER_FEATURES = {
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

function getUserTier(subscriptions, userId) {
  if (!subscriptions || !userId) return "free";
  var sub = subscriptions[userId];
  if (!sub) return "free";
  if (sub.status !== "active") return "free";
  if (sub.current_period_end) {
    var grace = 3 * 24 * 60 * 60 * 1000;
    if (new Date(sub.current_period_end).getTime() + grace < Date.now()) return "free";
  }
  return sub.tier || "free";
}

function hasFeature(tier, feature) {
  var features = TIER_FEATURES[tier] || TIER_FEATURES.free;
  return !!features[feature];
}
```

- [ ] **Step 2: Add subscription state to root TFTClash component**

In the `TFTClash()` function (line 17621), add state for subscriptions:

```javascript
var _sub = useState({});
var subscriptions = _sub[0];
var setSubscriptions = _sub[1];
```

Add a useEffect to load subscriptions from Supabase:

```javascript
useEffect(function() {
  supabase.from("user_subscriptions").select("*").then(function(res) {
    if (res.data) {
      var map = {};
      res.data.forEach(function(s) { map[s.user_id] = s; });
      setSubscriptions(map);
    }
  });
}, []);
```

- [ ] **Step 3: Pass tier info to screens that need it**

Add `userTier` computation and pass it as a prop. In the root render area:

```javascript
var userTier = currentUser ? getUserTier(subscriptions, currentUser.id) : "free";
```

Pass `userTier` to HomeScreen, ProfileScreen, StandingsScreen, PlayerProfileScreen, and PricingScreen props.

- [ ] **Step 4: Verify brace balance**

Run: `node -e "var f=require('fs').readFileSync('src/App.jsx','utf8');console.log('Balance:',f.split('{').length-f.split('}').length)"`
Expected: `Balance: 0`

- [ ] **Step 5: Build check**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add tier system with TIER_FEATURES, getUserTier, and hasFeature helpers"
```

---

### Task 3: Guest Home Screen Cleanup

**Files:**
- Modify: `src/App.jsx` - `HomeScreen()` function (starts at line 4050)

**Context:** The guest experience should be a clean landing page: hero, how-it-works, social proof, CTA. Remove clutter. See spec Section 3. Currently the guest path is tangled with logged-in rendering. Clean separation needed.

- [ ] **Step 1: Restructure the HomeScreen return to cleanly separate guest vs logged-in**

The current `HomeScreen` has guest and logged-in content interleaved. Restructure so the function has an early return for guests:

At the top of the return block (after all the computed variables, around line 4320), replace the current return with a guest-first structure:

```javascript
// If not logged in, show guest landing page
if (!currentUser) {
  return React.createElement("div", {className: "page wrap fade-up"},
    // Announcement banner (if any)
    announcement ? React.createElement("div", {style: {background:"rgba(232,168,56,.08)",border:"1px solid rgba(232,168,56,.3)",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}},
      React.createElement("i", {className: "ti ti-speakerphone", style:{fontSize:16,color:"#E8A838"}}),
      React.createElement("span", {style:{color:"#E8A838",fontWeight:600,fontSize:14}}, announcement)
    ) : null,
    // Hero section
    React.createElement("div", {style:{position:"relative",padding:"48px 32px",borderRadius:20,background:"radial-gradient(ellipse at 30% 15%,rgba(155,114,207,.18) 0%,rgba(78,205,196,.05) 50%,rgba(8,8,15,0) 70%)",border:"1px solid rgba(155,114,207,.18)",marginBottom:24,textAlign:"center"}},
      React.createElement("div", {style:{display:"inline-flex",alignItems:"center",gap:7,padding:"5px 14px",background:"rgba(155,114,207,.12)",border:"1px solid rgba(155,114,207,.35)",borderRadius:20,marginBottom:24}},
        React.createElement("div", {style:{width:6,height:6,borderRadius:"50%",background:"#52C47C",animation:"pulse 2s infinite"}}),
        React.createElement("span", {className:"cond",style:{fontSize:11,fontWeight:700,color:"#C4B5FD",letterSpacing:".1em",textTransform:"uppercase"}}, "Free to compete - No paywall, ever")
      ),
      React.createElement("h1", {className:"display",style:{color:"#F2EDE4",lineHeight:.9,letterSpacing:".01em",marginBottom:20,maxWidth:700,marginLeft:"auto",marginRight:"auto"}},
        "The", React.createElement("br"),
        React.createElement("span", {style:{color:"#E8A838",textShadow:"0 0 60px rgba(232,168,56,.5),0 0 120px rgba(232,168,56,.2)"}}, "COMPETITIVE TFT"),
        React.createElement("br"),
        React.createElement("span", {style:{background:"linear-gradient(135deg,#9B72CF,#4ECDC4)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}, "PLATFORM")
      ),
      React.createElement("p", {style:{fontSize:16,color:"#C8D4E0",lineHeight:1.65,marginBottom:28,maxWidth:520,marginLeft:"auto",marginRight:"auto"}},
        "Weekly Saturday tournaments, seasonal standings, and a permanent record of every champion crowned. Join " + players.length + " players competing this season."
      ),
      React.createElement("div", {style:{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:28}},
        React.createElement(Btn, {v:"primary",s:"lg",onClick:function(){onAuthClick("signup");}}, "Create Free Account"),
        React.createElement(Btn, {v:"ghost",s:"lg",onClick:function(){onAuthClick("login");}}, "Sign In")
      ),
      // Stats row with count-up feel
      React.createElement("div", {style:{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}},
        [[players.length,"Players","#E8A838"],[players.reduce(function(s,p){return s+(p.games||0);},0),"Games Played","#4ECDC4"],[players.reduce(function(s,p){return s+p.pts;},0),"Season Points","#9B72CF"]].map(function(item){
          return React.createElement("div",{key:item[1],style:{textAlign:"center",minWidth:80}},
            React.createElement("div",{className:"mono",style:{fontSize:24,fontWeight:800,color:item[2],lineHeight:1}},item[0]),
            React.createElement("div",{style:{fontSize:10,color:"#9AAABF",marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}},item[1])
          );
        })
      )
    ),
    // How It Works
    React.createElement(Panel, {style:{padding:"24px",marginBottom:24}},
      React.createElement("h3", {style:{fontSize:16,fontWeight:700,color:"#F2EDE4",marginBottom:18,textAlign:"center"}}, "How It Works"),
      React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16}},
        [{n:"01",t:"Sign Up",d:"Create a free account and link your Riot ID."},{n:"02",t:"Register",d:"Register for the next clash. Check in to confirm your spot."},{n:"03",t:"Compete",d:"Play your lobby games and submit your placement."},{n:"04",t:"Win the Crown",d:"Season leader is crowned Champion and enters the Hall of Fame."}].map(function(step){
          return React.createElement("div",{key:step.n,style:{textAlign:"center",padding:"16px 12px"}},
            React.createElement("div",{style:{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,rgba(155,114,207,.2),rgba(155,114,207,.08))",border:"1px solid rgba(155,114,207,.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#C4B5FD",margin:"0 auto 10px"}},step.n),
            React.createElement("div",{style:{fontWeight:700,fontSize:14,color:"#F2EDE4",marginBottom:4}},step.t),
            React.createElement("div",{style:{fontSize:12,color:"#BECBD9",lineHeight:1.5}},step.d)
          );
        })
      )
    )
  );
}
```

- [ ] **Step 2: Verify no em dashes in any string**

Search the new code for the characters `\u2014` (em dash) and `\u2013` (en dash). There should be zero.

- [ ] **Step 3: Build check + brace balance**

Run: `node -e "var f=require('fs').readFileSync('src/App.jsx','utf8');console.log('Balance:',f.split('{').length-f.split('}').length)"` then `npx vite build`
Expected: Balance 0, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: clean guest home screen - hero, how-it-works, social proof only"
```

---

### Task 4: Logged-In Home Screen - The Pulse (Zone 1)

**Files:**
- Modify: `src/App.jsx` - `HomeScreen()` function

**Context:** After the guest early-return, the rest of HomeScreen is the logged-in dashboard. Zone 1 is the top strip: countdown, rank + delta, points to tier, action button. Spec Section 4, Zone 1.

- [ ] **Step 1: Define tier thresholds constant**

Add near other constants (around line 100):

```javascript
var TIER_THRESHOLDS = [
  {name: "Champion", minRank: 1, maxRank: 1, color: "#E8A838", icon: "crown"},
  {name: "Challenger", minRank: 2, maxRank: 3, color: "#9B72CF", icon: "diamond"},
  {name: "Contender", minRank: 4, maxRank: 8, color: "#4ECDC4", icon: "shield"}
];

function getPlayerTierInfo(rank, totalPlayers) {
  for (var i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (rank >= TIER_THRESHOLDS[i].minRank && rank <= TIER_THRESHOLDS[i].maxRank) {
      return TIER_THRESHOLDS[i];
    }
  }
  return {name: "Competitor", minRank: 9, maxRank: totalPlayers, color: "#9AAABF", icon: "user"};
}

function getNextTierInfo(rank) {
  for (var i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (rank > TIER_THRESHOLDS[i].maxRank) {
      return TIER_THRESHOLDS[i];
    }
  }
  return null;
}
```

- [ ] **Step 2: Replace the current logged-in home content with Zone 1 (The Pulse)**

After the guest early-return, the logged-in return starts. Replace the old hero panel, stat boxes, and countdown with Zone 1:

```javascript
// Zone 1: The Pulse
var rankDelta = linkedPlayer && linkedPlayer.last_clash_rank ? myRankIdx - linkedPlayer.last_clash_rank : 0;
var currentTierInfo = getPlayerTierInfo(myRankIdx, players.length);
var nextTier = getNextTierInfo(myRankIdx);
var ptsToNextTier = null;
if (nextTier && myRankIdx > nextTier.maxRank) {
  var tierBorderPlayer = sortedPts[nextTier.maxRank - 1];
  if (tierBorderPlayer) ptsToNextTier = tierBorderPlayer.pts - (linkedPlayer ? linkedPlayer.pts : 0);
}

// Build action button based on phase
var pulseAction = null;
if (tPhase === "registration" && !isMyRegistered && !isMyWaitlisted && profileComplete && linkedPlayer) {
  pulseAction = React.createElement(Btn, {v:"primary",s:"sm",onClick:registerFromAccount}, "Register");
} else if (tPhase === "checkin" && isMyRegistered && !myCheckedIn) {
  pulseAction = React.createElement(Btn, {v:"success",s:"sm",onClick:handleCheckIn}, "Check In");
} else if (tPhase === "inprogress") {
  pulseAction = React.createElement(Btn, {v:"success",s:"sm",onClick:function(){setScreen("clash");}}, "Watch Live");
} else if (tPhase === "complete") {
  pulseAction = React.createElement(Btn, {v:"purple",s:"sm",onClick:function(){setScreen("clash");}}, "View Results");
}
```

Then render Zone 1 as the first element in the logged-in return:

```javascript
React.createElement("div", {className:"fade-up", style:{background:"linear-gradient(135deg,rgba(155,114,207,.06),rgba(8,8,15,.3))",border:"1px solid rgba(155,114,207,.15)",borderRadius:14,padding:"16px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}},
  // Countdown or live indicator
  React.createElement("div", {style:{minWidth:120}},
    tPhase === "inprogress"
      ? React.createElement("div", {style:{display:"flex",alignItems:"center",gap:6}},
          React.createElement("div", {style:{width:8,height:8,borderRadius:"50%",background:"#52C47C",animation:"pulse 2s infinite"}}),
          React.createElement("span", {style:{fontSize:13,fontWeight:700,color:"#6EE7B7"}}, "LIVE - Game " + tRound + "/" + (tournamentState.totalGames || 3))
        )
      : React.createElement("div", null,
          React.createElement("div", {className:"cond",style:{fontSize:9,fontWeight:700,color:"#9B72CF",letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}, clashName),
          React.createElement("div", {className:"mono",style:{fontSize:16,fontWeight:700,color:"#E8A838"}},
            D > 0 ? D + "d " + H + "h" : H > 0 ? H + "h " + M + "m" : M + "m " + S + "s"
          )
        )
  ),
  // Rank + delta
  linkedPlayer ? React.createElement("div", {style:{display:"flex",alignItems:"center",gap:8}},
    React.createElement("div", {className:"mono",style:{fontSize:28,fontWeight:800,color:currentTierInfo.color,lineHeight:1}}, "#" + myRankIdx),
    rankDelta !== 0 ? React.createElement("div", {style:{display:"flex",alignItems:"center",gap:3,fontSize:12,fontWeight:700,color:rankDelta < 0 ? "#6EE7B7" : "#F87171"}},
      React.createElement("i", {className:"ti ti-" + (rankDelta < 0 ? "arrow-up" : "arrow-down"), style:{fontSize:12}}),
      Math.abs(rankDelta) + " since last clash"
    ) : null
  ) : null,
  // Points to next tier
  nextTier && ptsToNextTier > 0 ? React.createElement("div", {style:{fontSize:11,color:"#BECBD9"}},
    ptsToNextTier + " pts to " + nextTier.name
  ) : null,
  // Spacer
  React.createElement("div", {style:{flex:1}}),
  // Action button
  pulseAction
)
```

- [ ] **Step 3: Remove old stat boxes, hero panel, countdown from logged-in path**

Delete the old `grid-home` div with hero panel, stat boxes, "CONVERGENCE AWAITS", and the old countdown. These are replaced by Zone 1 + Zone 2 (next task).

- [ ] **Step 4: Build check + brace balance**

Run: `node -e "var f=require('fs').readFileSync('src/App.jsx','utf8');console.log('Balance:',f.split('{').length-f.split('}').length)"` then `npx vite build`
Expected: Balance 0, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: logged-in home Zone 1 (The Pulse) - rank, countdown, action button"
```

---

### Task 5: Logged-In Home Screen - Your Story (Zone 2)

**Files:**
- Modify: `src/App.jsx` - `HomeScreen()` function

**Context:** The emotional core. Season trajectory sparkline, last clash result, active streaks, projected finish. Spec Section 4, Zone 2.

- [ ] **Step 1: Add a Sparkline helper component**

Add before HomeScreen (around line 4040). This is a reusable SVG sparkline used across standings and profiles too:

```javascript
function Sparkline(props) {
  var data = props.data || [];
  var w = props.width || 60;
  var h = props.height || 20;
  var color = props.color || "#9B72CF";
  if (data.length < 2) return null;
  var min = Math.min.apply(null, data);
  var max = Math.max.apply(null, data);
  var range = max - min || 1;
  var points = data.map(function(v, i) {
    var x = (i / (data.length - 1)) * w;
    var y = h - ((v - min) / range) * (h - 4) - 2;
    return x + "," + y;
  }).join(" ");
  return React.createElement("svg", {width:w, height:h, style:{display:"block"}},
    React.createElement("polyline", {
      points: points,
      fill: "none",
      stroke: color,
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }),
    React.createElement("circle", {
      cx: w,
      cy: parseFloat(points.split(" ").pop().split(",")[1]),
      r: 2,
      fill: color
    })
  );
}
```

- [ ] **Step 2: Compute Zone 2 data variables**

Add these computations in HomeScreen, after the Zone 1 variables:

```javascript
// Zone 2: Your Story data
var clashHistory = (linkedPlayer && linkedPlayer.clashHistory) || [];
var lastClash = clashHistory.length > 0 ? clashHistory[clashHistory.length - 1] : null;
var placementTrend = clashHistory.map(function(c) { return c.placement || 4; });
var pointsTrend = [];
var cumPts = 0;
clashHistory.forEach(function(c) {
  cumPts = cumPts + (c.points || 0);
  pointsTrend.push(cumPts);
});

// Streak calculation
var currentStreak = 0;
var streakType = "";
for (var si = clashHistory.length - 1; si >= 0; si--) {
  if (clashHistory[si].placement <= 4) {
    currentStreak++;
    streakType = "top-4";
  } else break;
}
if (currentStreak === 0) {
  for (var sj = clashHistory.length - 1; sj >= 0; sj--) {
    if (clashHistory[sj].placement === 1) {
      currentStreak++;
      streakType = "win";
    } else break;
  }
}

// Projected finish (simple linear projection)
var projectedRank = null;
var projectedPts = null;
if (linkedPlayer && clashHistory.length >= 2) {
  var avgPtsPerClash = linkedPlayer.pts / clashHistory.length;
  var remainingClashes = Math.max(0, (seasonConfig.totalClashes || 12) - clashHistory.length);
  projectedPts = Math.round(linkedPlayer.pts + avgPtsPerClash * remainingClashes);
}
```

- [ ] **Step 3: Render Zone 2**

After Zone 1, render the story section:

```javascript
// Zone 2: Your Story
React.createElement("div", {style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}},
  // Season trajectory card (left, spans full width on mobile)
  React.createElement(Panel, {style:{padding:"18px",gridColumn:pointsTrend.length > 1 ? "1 / -1" : undefined}},
    React.createElement("div", {className:"cond",style:{fontSize:9,fontWeight:700,color:"#9B72CF",letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}, "Season Trajectory"),
    pointsTrend.length > 1
      ? React.createElement(Sparkline, {data:pointsTrend, width:280, height:40, color:"#9B72CF"})
      : React.createElement("div", {style:{fontSize:12,color:"#9AAABF"}}, "Play your first clash to see your trajectory"),
    projectedPts ? React.createElement("div", {style:{fontSize:11,color:"#BECBD9",marginTop:8}},
      "Projected finish: " + projectedPts + " pts"
    ) : null
  ),
  // Last clash result
  lastClash ? React.createElement(Panel, {style:{padding:"18px"}},
    React.createElement("div", {className:"cond",style:{fontSize:9,fontWeight:700,color:"#4ECDC4",letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}}, "Last Clash"),
    React.createElement("div", {style:{display:"flex",alignItems:"baseline",gap:8}},
      React.createElement("span", {className:"mono",style:{fontSize:24,fontWeight:800,color:lastClash.placement <= 3 ? "#E8A838" : "#F2EDE4"}}, ordinal(lastClash.placement)),
      React.createElement("span", {style:{fontSize:13,fontWeight:600,color:"#6EE7B7"}}, "+" + (lastClash.points || 0) + " pts")
    )
  ) : null,
  // Active streaks
  currentStreak > 1 ? React.createElement(Panel, {style:{padding:"18px"}},
    React.createElement("div", {className:"cond",style:{fontSize:9,fontWeight:700,color:"#E8A838",letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}}, "Active Streak"),
    React.createElement("div", {style:{display:"flex",alignItems:"center",gap:6}},
      React.createElement("i", {className:"ti ti-flame",style:{color:"#E8A838",fontSize:18}}),
      React.createElement("span", {className:"mono",style:{fontSize:20,fontWeight:800,color:"#E8A838"}}, currentStreak),
      React.createElement("span", {style:{fontSize:12,color:"#BECBD9"}}, streakType + " streak")
    )
  ) : null,
  // Quick stats row
  linkedPlayer ? React.createElement("div", {style:{display:"flex",gap:10,flexWrap:"wrap",gridColumn:"1 / -1"}},
    [
      [linkedPlayer.pts, "Season Pts", "#E8A838"],
      [linkedPlayer.wins, "Wins", "#6EE7B7"],
      [s2 ? s2.avgPlacement : "-", "Avg Place", "#4ECDC4"],
      [s2 ? (s2.top4Rate || 0) + "%" : "-", "Top 4 Rate", "#9B72CF"]
    ].map(function(item) {
      return React.createElement("div", {key:item[1],style:{background:"rgba(255,255,255,.04)",borderRadius:10,padding:"10px 14px",textAlign:"center",flex:"1 1 60px",minWidth:60}},
        React.createElement("div", {className:"mono",style:{fontSize:18,fontWeight:700,color:item[2],lineHeight:1}}, item[0]),
        React.createElement("div", {style:{fontSize:9,color:"#BECBD9",marginTop:4,fontWeight:600,textTransform:"uppercase"}}, item[1])
      );
    })
  ) : null
)
```

- [ ] **Step 4: Add ordinal helper if not exists**

Check if an `ordinal()` function exists. If not, add near other helpers:

```javascript
function ordinal(n) {
  var s = ["th","st","nd","rd"];
  var v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}
```

- [ ] **Step 5: Build check + brace balance**

Run brace balance check + `npx vite build`.
Expected: Balance 0, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: logged-in home Zone 2 (Your Story) - trajectory, last result, streaks"
```

---

### Task 6: Logged-In Home Screen - The Scene (Zone 3) + Activity Feed

**Files:**
- Modify: `src/App.jsx` - `HomeScreen()` function

**Context:** Activity feed, season narrative, quick actions. Spec Section 4, Zone 3. The activity feed reads from `activity_feed` table.

- [ ] **Step 1: Add activity feed fetch in HomeScreen**

```javascript
var _af = useState([]);
var activityFeed = _af[0];
var setActivityFeed = _af[1];

useEffect(function() {
  supabase.from("activity_feed").select("*")
    .order("created_at", {ascending: false})
    .limit(8)
    .then(function(res) {
      if (res.data) setActivityFeed(res.data);
    });
}, [tick]);
```

- [ ] **Step 2: Add season narrative generator function**

Add before HomeScreen:

```javascript
function generateSeasonNarrative(players, sortedPts) {
  if (!sortedPts || sortedPts.length < 2) return null;
  var leader = sortedPts[0];
  var second = sortedPts[1];
  var gap = leader.pts - second.pts;
  if (gap <= 5) return "The race for #1 is tight. Only " + gap + " pts separate " + leader.name + " and " + second.name + ".";
  if (gap > 50) return leader.name + " leads the season with a commanding " + gap + "-point advantage.";
  // Check close pack at 3-5
  if (sortedPts.length >= 5) {
    var thirdPts = sortedPts[2].pts;
    var fifthPts = sortedPts[4].pts;
    if (thirdPts - fifthPts <= 10) return "Positions 3 through 5 are separated by just " + (thirdPts - fifthPts) + " pts. Every clash matters.";
  }
  return leader.name + " leads the season with " + leader.pts + " pts.";
}
```

- [ ] **Step 3: Render Zone 3**

After Zone 2, render the scene:

```javascript
// Zone 3: The Scene
React.createElement("div", {style:{marginBottom:20}},
  // Season narrative
  React.createElement("div", {style:{background:"rgba(155,114,207,.06)",border:"1px solid rgba(155,114,207,.15)",borderRadius:10,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:8}},
    React.createElement("i", {className:"ti ti-book",style:{color:"#9B72CF",fontSize:14}}),
    React.createElement("span", {style:{fontSize:12,fontWeight:600,color:"#C4B5FD"}}, generateSeasonNarrative(players, sortedPts) || "Season is underway.")
  ),
  // Activity feed
  activityFeed.length > 0 ? React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:6}},
    React.createElement("div", {className:"cond",style:{fontSize:9,fontWeight:700,color:"#9AAABF",letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}, "Recent Activity"),
    activityFeed.slice(0, 5).map(function(item) {
      var icon = item.type === "rank_change" ? "arrow-up-right" : item.type === "registration" ? "clipboard-check" : item.type === "result" ? "trophy" : "activity";
      var timeAgo = Math.round((Date.now() - new Date(item.created_at).getTime()) / 60000);
      var timeStr = timeAgo < 60 ? timeAgo + "m ago" : Math.round(timeAgo / 60) + "h ago";
      var detail = item.detail_json || {};
      return React.createElement("div", {key:item.id,style:{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}},
        React.createElement("i", {className:"ti ti-" + icon, style:{color:"#9AAABF",fontSize:13}}),
        React.createElement("span", {style:{fontSize:12,color:"#BECBD9",flex:1}}, detail.text || item.type),
        React.createElement("span", {style:{fontSize:10,color:"#6B7B8F"}}, timeStr)
      );
    })
  ) : null,
  // Quick actions
  React.createElement("div", {style:{display:"flex",gap:8,marginTop:14}},
    React.createElement(Btn, {v:"dark",s:"sm",onClick:function(){setScreen("standings");}}, "Standings"),
    React.createElement(Btn, {v:"dark",s:"sm",onClick:function(){if(linkedPlayer){setProfilePlayer(linkedPlayer);setScreen("profile");}}}, "My Profile"),
    upcomingTournament ? React.createElement(Btn, {v:"purple",s:"sm",onClick:function(){setScreen("flash-"+upcomingTournament.id);}}, "Flash Tournament") : null
  )
)
```

- [ ] **Step 4: Remove old ticker, welcome card, "Join clashName" panel, and registration card pile**

Delete the old content that Zone 1-3 replaces: the community pulse ticker, the "Welcome back" card, the grid-home layout with hero + register panel, the duplicate registration cards for 5 auth states.

- [ ] **Step 5: Build check + brace balance + visual test**

Run brace balance + build. Then `npx vite dev` and verify:
- Guest sees clean landing page
- Logged-in sees 3-zone dashboard

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: logged-in home Zone 3 (The Scene) - activity feed, narrative, quick actions"
```

---

### Task 7: Standings Screen - Tier Lines, Sparklines, Deltas

**Files:**
- Modify: `src/App.jsx` - `LeaderboardScreen()` (line 7156) and `StandingsTable()` (line 3554)

**Context:** Add tier threshold lines, sparklines per player row, delta arrows, and "your row" highlighting. Spec Section 5.

- [ ] **Step 1: Update StandingsTable to support tier lines and sparklines**

In the `StandingsTable` function (line 3554), modify the rendering:

1. Before each row, check if a tier threshold line should be drawn:

```javascript
// Inside the map over sorted players, before the row element:
var showTierLine = false;
var tierLineInfo = null;
for (var ti = 0; ti < TIER_THRESHOLDS.length; ti++) {
  if (idx + 1 === TIER_THRESHOLDS[ti].maxRank + 1 && idx > 0) {
    showTierLine = true;
    tierLineInfo = TIER_THRESHOLDS[ti];
  }
}
```

2. Render tier line divider when `showTierLine` is true:

```javascript
showTierLine ? React.createElement("div", {key:"tier-" + idx, style:{display:"flex",alignItems:"center",gap:8,padding:"4px 0",margin:"4px 0"}},
  React.createElement("div", {style:{flex:1,height:1,background:tierLineInfo.color,opacity:0.4}}),
  React.createElement("span", {className:"cond",style:{fontSize:8,fontWeight:700,color:tierLineInfo.color,letterSpacing:".1em",textTransform:"uppercase"}}, tierLineInfo.name),
  React.createElement("div", {style:{flex:1,height:1,background:tierLineInfo.color,opacity:0.4}})
) : null
```

3. Add sparkline to each player row (after the points column):

```javascript
React.createElement(Sparkline, {
  data: (p.clashHistory || []).slice(-5).map(function(c) { return c.placement || 4; }),
  width: 50,
  height: 16,
  color: "#9B72CF"
})
```

4. Add delta arrow for rank changes:

```javascript
p.last_clash_rank ? React.createElement("span", {style:{fontSize:11,fontWeight:700,color:p.last_clash_rank > (idx+1) ? "#6EE7B7" : p.last_clash_rank < (idx+1) ? "#F87171" : "#9AAABF"}},
  p.last_clash_rank > (idx+1) ? "+" + (p.last_clash_rank - (idx+1)) : p.last_clash_rank < (idx+1) ? (p.last_clash_rank - (idx+1)) : ""
) : null
```

5. Highlight user's own row:

```javascript
var isMyRow = linkedPlayer && p.id === linkedPlayer.id;
// Add to row style:
borderLeft: isMyRow ? "3px solid #9B72CF" : "3px solid transparent",
background: isMyRow ? "rgba(155,114,207,.08)" : undefined
```

- [ ] **Step 2: Build check + brace balance**

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: standings tier lines, sparklines, deltas, own-row highlight"
```

---

### Task 8: Profile Screen - Stats Grid, Placement Distribution, Trajectory

**Files:**
- Modify: `src/App.jsx` - `AccountScreen()` (line 13310) and `PlayerProfileScreen()` (line 6386)

**Context:** Transform profiles into "competitive passports" with stats grid, placement distribution bar, season trajectory chart. Spec Section 6 and Section 7.

- [ ] **Step 1: Add PlacementDistribution component**

Add before AccountScreen. This is the signature data viz:

```javascript
function PlacementDistribution(props) {
  var history = props.history || [];
  if (history.length === 0) return null;
  var counts = [0,0,0,0,0,0,0,0];
  history.forEach(function(h) {
    var games = h.games || [];
    games.forEach(function(g) {
      if (g.placement >= 1 && g.placement <= 8) counts[g.placement - 1]++;
    });
  });
  var total = counts.reduce(function(s,c){return s+c;}, 0);
  if (total === 0) return null;
  var colors = ["#E8A838","#C0C0C0","#CD7F32","#9B72CF","#4ECDC4","#6B7B8F","#4A5568","#2D3748"];
  return React.createElement("div", {style:{marginBottom:16}},
    React.createElement("div", {className:"cond",style:{fontSize:9,fontWeight:700,color:"#9AAABF",letterSpacing:".12em",textTransform:"uppercase",marginBottom:6}}, "Placement Distribution"),
    React.createElement("div", {style:{display:"flex",height:20,borderRadius:6,overflow:"hidden",background:"rgba(255,255,255,.04)"}},
      counts.map(function(c, i) {
        var pct = total > 0 ? (c / total * 100) : 0;
        if (pct === 0) return null;
        return React.createElement("div", {
          key:i,
          title: ordinal(i+1) + ": " + c + " (" + Math.round(pct) + "%)",
          style:{width:pct+"%",background:colors[i],transition:"width .5s ease"}
        });
      })
    ),
    React.createElement("div", {style:{display:"flex",justifyContent:"space-between",marginTop:4}},
      counts.map(function(c, i) {
        return React.createElement("div", {key:i,style:{textAlign:"center",flex:1,fontSize:9,color:c > 0 ? colors[i] : "#4A5568",fontWeight:600}},
          ordinal(i+1)
        );
      })
    )
  );
}
```

- [ ] **Step 2: Add stats grid to AccountScreen**

In AccountScreen, after the profile header, add a stats grid:

```javascript
// Stats grid (2x3)
React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}},
  [
    {label:"Win Rate",val:stats ? Math.round(stats.winRate || 0) + "%" : "0%",color:"#E8A838",icon:"trophy"},
    {label:"Avg Placement",val:stats ? (stats.avgPlacement || 0).toFixed(1) : "-",color:stats && stats.avgPlacement < 4 ? "#6EE7B7" : "#F2EDE4",icon:"chart-line"},
    {label:"Best Streak",val:stats ? (stats.bestStreak || 0) : 0,color:"#E8A838",icon:"flame"},
    {label:"Total Wins",val:playerData ? playerData.wins : 0,color:"#6EE7B7",icon:"crown"},
    {label:"Top 4 Rate",val:stats ? Math.round(stats.top4Rate || 0) + "%" : "0%",color:"#4ECDC4",icon:"target"},
    {label:"Consistency",val:playerData ? (playerData.consistency_grade || "B") : "-",color:"#9B72CF",icon:"shield-check"}
  ].map(function(s) {
    return React.createElement("div", {key:s.label,style:{background:"rgba(255,255,255,.04)",borderRadius:10,padding:"14px 10px",textAlign:"center"}},
      React.createElement("i", {className:"ti ti-" + s.icon, style:{color:s.color,fontSize:16,marginBottom:4,display:"block"}}),
      React.createElement("div", {className:"mono",style:{fontSize:20,fontWeight:700,color:s.color,lineHeight:1}}, s.val),
      React.createElement("div", {style:{fontSize:9,color:"#BECBD9",marginTop:4,fontWeight:600,textTransform:"uppercase"}}, s.label)
    );
  })
)
```

- [ ] **Step 3: Add PlacementDistribution and Sparkline trajectory to profile**

After stats grid:

```javascript
React.createElement(PlacementDistribution, {history: playerData ? playerData.clashHistory : []}),
React.createElement("div", {style:{marginBottom:16}},
  React.createElement("div", {className:"cond",style:{fontSize:9,fontWeight:700,color:"#9B72CF",letterSpacing:".12em",textTransform:"uppercase",marginBottom:8}}, "Season Trajectory"),
  React.createElement(Sparkline, {
    data: (playerData && playerData.clashHistory || []).map(function(c) { return c.cumPoints || 0; }),
    width: 260,
    height: 40,
    color: "#9B72CF"
  })
)
```

- [ ] **Step 4: Apply same enhancements to PlayerProfileScreen**

Mirror the stats grid, PlacementDistribution, and trajectory in PlayerProfileScreen for viewing other players. Add "Compare" button:

```javascript
React.createElement(Btn, {v:"purple",s:"sm",onClick:function(){setComparePlayer(profilePlayer);}}, "Compare")
```

- [ ] **Step 5: Build check + brace balance**

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: profile overhaul - stats grid, placement distribution, trajectory chart"
```

---

## Phase 2: Competitive Features (Tasks 9-13)

After this phase: pricing with feature gating works, achievements persist to DB, activity feed updates in real-time, onboarding flow converts new signups.

---

### Task 9: Player Comparison Modal

**Files:**
- Modify: `src/App.jsx` - add new component + modal state in root

**Context:** Side-by-side stat comparison between two players. Spec Section 7.1.

- [ ] **Step 1: Add PlayerComparisonModal component**

Add before the root TFTClash component:

```javascript
function PlayerComparisonModal(props) {
  var me = props.playerA;
  var them = props.playerB;
  var players = props.players;
  var onClose = props.onClose;
  if (!me || !them) return null;

  var meStats = getStats(me);
  var themStats = getStats(them);
  var h2h = computeH2H(me, them, props.pastClashes || []);
  var meRank = players.filter(function(p){return p.pts > me.pts;}).length + 1;
  var themRank = players.filter(function(p){return p.pts > them.pts;}).length + 1;

  var rows = [
    {label:"Rank",a:"#"+meRank,b:"#"+themRank,better:meRank < themRank ? "a" : meRank > themRank ? "b" : null},
    {label:"Points",a:me.pts,b:them.pts,better:me.pts > them.pts ? "a" : me.pts < them.pts ? "b" : null},
    {label:"Wins",a:me.wins,b:them.wins,better:me.wins > them.wins ? "a" : me.wins < them.wins ? "b" : null},
    {label:"Avg Placement",a:meStats.avgPlacement ? meStats.avgPlacement.toFixed(1) : "-",b:themStats.avgPlacement ? themStats.avgPlacement.toFixed(1) : "-",better:meStats.avgPlacement < themStats.avgPlacement ? "a" : meStats.avgPlacement > themStats.avgPlacement ? "b" : null},
    {label:"Win Rate",a:Math.round(meStats.winRate || 0)+"%",b:Math.round(themStats.winRate || 0)+"%",better:(meStats.winRate||0) > (themStats.winRate||0) ? "a" : (meStats.winRate||0) < (themStats.winRate||0) ? "b" : null},
    {label:"Top 4 Rate",a:Math.round(meStats.top4Rate || 0)+"%",b:Math.round(themStats.top4Rate || 0)+"%",better:(meStats.top4Rate||0) > (themStats.top4Rate||0) ? "a" : (meStats.top4Rate||0) < (themStats.top4Rate||0) ? "b" : null}
  ];

  return React.createElement("div", {style:{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999},onClick:onClose},
    React.createElement("div", {style:{background:"#111827",border:"1px solid rgba(155,114,207,.3)",borderRadius:16,padding:"24px",maxWidth:480,width:"90%",maxHeight:"80vh",overflowY:"auto"},onClick:function(e){e.stopPropagation();}},
      // H2H header
      h2h ? React.createElement("div", {style:{textAlign:"center",marginBottom:16}},
        React.createElement("div", {style:{fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:4}}, me.name + " vs " + them.name),
        React.createElement("div", {style:{fontSize:11,color:"#9B72CF"}}, h2h.wins + "-" + h2h.losses + " in " + h2h.total + " shared lobbies")
      ) : React.createElement("div", {style:{textAlign:"center",fontSize:13,fontWeight:700,color:"#F2EDE4",marginBottom:16}}, me.name + " vs " + them.name),
      // Stat rows
      rows.map(function(row) {
        return React.createElement("div", {key:row.label,style:{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.06)",alignItems:"center"}},
          React.createElement("div", {style:{textAlign:"right",fontSize:15,fontWeight:700,color:row.better === "a" ? "#6EE7B7" : "#F2EDE4",background:row.better === "a" ? "rgba(110,231,183,.08)" : "transparent",borderRadius:6,padding:"4px 8px"}}, row.a),
          React.createElement("div", {style:{fontSize:10,color:"#9AAABF",textTransform:"uppercase",fontWeight:600,textAlign:"center",minWidth:80}}, row.label),
          React.createElement("div", {style:{textAlign:"left",fontSize:15,fontWeight:700,color:row.better === "b" ? "#6EE7B7" : "#F2EDE4",background:row.better === "b" ? "rgba(110,231,183,.08)" : "transparent",borderRadius:6,padding:"4px 8px"}}, row.b)
        );
      }),
      // Overlaid sparklines
      React.createElement("div", {style:{position:"relative",height:40,marginTop:16,marginBottom:8}},
        React.createElement("div", {style:{position:"absolute",inset:0}},
          React.createElement(Sparkline, {data:(me.clashHistory||[]).slice(-8).map(function(c){return c.placement||4;}), width:200, height:40, color:"#9B72CF"})
        ),
        React.createElement("div", {style:{position:"absolute",inset:0}},
          React.createElement(Sparkline, {data:(them.clashHistory||[]).slice(-8).map(function(c){return c.placement||4;}), width:200, height:40, color:"#4ECDC4"})
        ),
        React.createElement("div", {style:{display:"flex",gap:12,justifyContent:"center",marginTop:2}},
          React.createElement("span", {style:{fontSize:9,color:"#9B72CF",fontWeight:600}}, me.name),
          React.createElement("span", {style:{fontSize:9,color:"#4ECDC4",fontWeight:600}}, them.name)
        )
      ),
      // Close button
      React.createElement("div", {style:{textAlign:"center",marginTop:16}},
        React.createElement(Btn, {v:"dark",s:"sm",onClick:onClose}, "Close")
      )
    )
  );
}
```

- [ ] **Step 2: Add modal state in root TFTClash and wire it up**

In TFTClash root, add:

```javascript
var _cmp = useState(null);
var comparePlayer = _cmp[0];
var setComparePlayer = _cmp[1];
```

Before the closing root div, render the modal:

```javascript
comparePlayer ? React.createElement(PlayerComparisonModal, {
  playerA: linkedPlayer,
  playerB: comparePlayer,
  players: players,
  pastClashes: pastClashes,
  onClose: function() { setComparePlayer(null); }
}) : null
```

Pass `setComparePlayer` to PlayerProfileScreen and StandingsScreen.

- [ ] **Step 3: Build check + brace balance**

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: player comparison modal with side-by-side stats and H2H record"
```

---

### Task 10: Pricing Screen with Feature Gating UI

**Files:**
- Modify: `src/App.jsx` - `PricingScreen()` (line 11940)

**Context:** Three-tier pricing with real feature gating. Payment provider TBD, but tier assignment works via admin panel. Spec Section 11.

- [ ] **Step 1: Rewrite PricingScreen with three tier cards**

Replace the current PricingScreen content with:

```javascript
function PricingScreen(props) {
  var currentUser = props.currentUser;
  var userTier = props.userTier || "free";

  var tiers = [
    {
      id: "free", name: "Player", price: "Free", period: "forever",
      color: "#F2EDE4", borderColor: "rgba(255,255,255,.1)",
      features: [
        "Compete in every clash",
        "Full standings and leaderboard",
        "Basic profile with stats",
        "View all results and recaps",
        "Current season history"
      ]
    },
    {
      id: "pro", name: "Pro", price: "$4.99", period: "/month",
      color: "#9B72CF", borderColor: "rgba(155,114,207,.5)",
      badge: "Recommended",
      features: [
        "Everything in Player, plus:",
        "Enhanced stats and consistency grade",
        "Pro badge on profile",
        "Priority registration",
        "Full career history (all seasons)",
        "Custom profile banner",
        "Player comparison tool",
        "Weekly email digest"
      ]
    },
    {
      id: "host", name: "Host", price: "$19.99", period: "/month",
      color: "#E8A838", borderColor: "rgba(232,168,56,.5)",
      features: [
        "Everything in Pro, plus:",
        "Create custom tournaments",
        "Branded tournament pages",
        "Host analytics dashboard",
        "Custom rules and formats",
        "Player management tools",
        "Priority support"
      ]
    }
  ];

  return React.createElement("div", {className:"page wrap fade-up"},
    React.createElement("h2", {className:"display",style:{textAlign:"center",marginBottom:8,color:"#F2EDE4"}}, "Choose Your Path"),
    React.createElement("p", {style:{textAlign:"center",fontSize:14,color:"#BECBD9",marginBottom:32}}, "Competing is always free. Upgrade for enhanced features."),

    React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginBottom:32}},
      tiers.map(function(tier) {
        var isActive = userTier === tier.id;
        return React.createElement("div", {key:tier.id,style:{
          background: tier.id === "pro" ? "linear-gradient(145deg,rgba(155,114,207,.1),rgba(8,8,15,.8))" : "rgba(17,24,39,.8)",
          border: "1px solid " + tier.borderColor,
          borderRadius: 16,
          padding: "24px 20px",
          position: "relative",
          boxShadow: tier.id === "pro" ? "0 0 30px rgba(155,114,207,.1)" : "none"
        }},
          tier.badge ? React.createElement("div", {style:{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:"#9B72CF",color:"#fff",fontSize:10,fontWeight:700,padding:"3px 12px",borderRadius:10,letterSpacing:".05em"}}, tier.badge) : null,
          React.createElement("div", {style:{textAlign:"center",marginBottom:16}},
            React.createElement("div", {style:{fontSize:18,fontWeight:700,color:tier.color,marginBottom:4}}, tier.name),
            React.createElement("div", {style:{display:"flex",alignItems:"baseline",justifyContent:"center",gap:2}},
              React.createElement("span", {className:"mono",style:{fontSize:32,fontWeight:800,color:"#F2EDE4"}}, tier.price),
              tier.period !== "forever" ? React.createElement("span", {style:{fontSize:12,color:"#9AAABF"}}, tier.period) : null
            )
          ),
          React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:8,marginBottom:20}},
            tier.features.map(function(f, fi) {
              return React.createElement("div", {key:fi,style:{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#BECBD9"}},
                React.createElement("i", {className:"ti ti-check",style:{color:tier.color,fontSize:14}}),
                React.createElement("span", null, f)
              );
            })
          ),
          isActive
            ? React.createElement("div", {style:{textAlign:"center",padding:"8px 0",fontSize:13,fontWeight:700,color:"#6EE7B7"}}, "Current Plan")
            : tier.id === "free"
              ? null
              : React.createElement("div", {style:{textAlign:"center",fontSize:12,color:"#9AAABF"}}, "Coming soon")
        );
      })
    ),
    // Free to compete banner
    React.createElement("div", {style:{textAlign:"center",padding:"16px",background:"rgba(78,205,196,.06)",border:"1px solid rgba(78,205,196,.2)",borderRadius:12}},
      React.createElement("div", {style:{fontSize:14,fontWeight:700,color:"#4ECDC4"}}, "Free to compete, always."),
      React.createElement("div", {style:{fontSize:12,color:"#BECBD9",marginTop:4}}, "Every player can enter every clash. Upgrades enhance your experience, never gate competition.")
    )
  );
}
```

- [ ] **Step 2: Add admin ability to set user tiers**

In AdminPanel, add a "Set Tier" control in the Player Management tab. When admin selects a player and tier:

```javascript
function setPlayerTier(userId, tier) {
  supabase.from("user_subscriptions").upsert({
    user_id: userId,
    tier: tier,
    provider: "manual",
    status: "active"
  }, {onConflict: "user_id"}).then(function(res) {
    if (res.error) { toast("Failed to set tier: " + res.error.message, "error"); }
    else { toast("Tier set to " + tier, "success"); }
  });
}
```

- [ ] **Step 3: Build check + brace balance**

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: pricing screen with tier cards and admin tier assignment"
```

---

### Task 11: Achievement System with DB Persistence

**Files:**
- Modify: `src/App.jsx` - add achievement definitions and evaluation logic

**Context:** Achievements evaluate after each clash, persist to `player_achievements` table, display on profiles. Spec Section 6.

- [ ] **Step 1: Define achievements constant**

Add near other constants:

```javascript
var ACHIEVEMENTS = [
  {id:"first_clash",name:"First Blood",desc:"Play your first clash",tier:"bronze",criteria:function(s){return s.games >= 1;}},
  {id:"five_clashes",name:"Veteran",desc:"Play 5 clashes",tier:"silver",criteria:function(s){return s.games >= 5;}},
  {id:"ten_clashes",name:"Dedicated",desc:"Play 10 clashes",tier:"gold",criteria:function(s){return s.games >= 10;}},
  {id:"first_win",name:"Champion",desc:"Win your first clash",tier:"bronze",criteria:function(s){return s.wins >= 1;}},
  {id:"three_wins",name:"Serial Winner",desc:"Win 3 clashes",tier:"silver",criteria:function(s){return s.wins >= 3;}},
  {id:"top4_five",name:"Consistent",desc:"Finish top 4 in 5 clashes",tier:"bronze",criteria:function(s){return (s.top4Count || 0) >= 5;}},
  {id:"top4_ten",name:"Iron Will",desc:"Finish top 4 in 10 clashes",tier:"silver",criteria:function(s){return (s.top4Count || 0) >= 10;}},
  {id:"streak_three",name:"On Fire",desc:"3-clash top-4 streak",tier:"bronze",criteria:function(s){return (s.bestStreak || 0) >= 3;}},
  {id:"streak_five",name:"Unstoppable",desc:"5-clash top-4 streak",tier:"gold",criteria:function(s){return (s.bestStreak || 0) >= 5;}},
  {id:"avg_under_3",name:"Elite",desc:"Season average placement under 3.0",tier:"gold",criteria:function(s){return s.avgPlacement > 0 && s.avgPlacement < 3;}},
  {id:"hundred_pts",name:"Century",desc:"Reach 100 season points",tier:"bronze",criteria:function(s){return s.pts >= 100;}},
  {id:"five_hundred_pts",name:"Legend",desc:"Reach 500 season points",tier:"gold",criteria:function(s){return s.pts >= 500;}}
];

var ACHIEVEMENT_TIER_COLORS = {bronze:"#CD7F32",silver:"#C0C0C0",gold:"#E8A838",legendary:"#9B72CF"};
```

- [ ] **Step 2: Add achievement evaluation function**

```javascript
function evaluateAchievements(player, existingAchievements) {
  var stats = getStats(player);
  stats.pts = player.pts;
  stats.wins = player.wins;
  stats.games = player.games || 0;
  var newAchievements = [];
  ACHIEVEMENTS.forEach(function(ach) {
    var already = existingAchievements.some(function(ea) { return ea.achievement_id === ach.id; });
    if (!already && ach.criteria(stats)) {
      newAchievements.push(ach.id);
    }
  });
  return newAchievements;
}
```

- [ ] **Step 3: Load and display achievements on profile**

In AccountScreen and PlayerProfileScreen, fetch achievements:

```javascript
var _ach = useState([]);
var achievements = _ach[0];
var setAchievements = _ach[1];

useEffect(function() {
  if (!playerData) return;
  supabase.from("player_achievements").select("*")
    .eq("player_id", playerData.id)
    .then(function(res) {
      if (res.data) setAchievements(res.data);
    });
}, [playerData]);
```

Render achievements grid:

```javascript
React.createElement("div", {style:{marginBottom:20}},
  React.createElement("div", {className:"cond",style:{fontSize:9,fontWeight:700,color:"#9AAABF",letterSpacing:".12em",textTransform:"uppercase",marginBottom:10}}, "Achievements"),
  React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:8}},
    ACHIEVEMENTS.map(function(ach) {
      var earned = achievements.some(function(a) { return a.achievement_id === ach.id; });
      var tierColor = ACHIEVEMENT_TIER_COLORS[ach.tier] || "#9AAABF";
      return React.createElement("div", {key:ach.id,style:{
        background: earned ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.02)",
        border: "1px solid " + (earned ? tierColor : "rgba(255,255,255,.06)"),
        borderRadius: 10,
        padding: "10px 8px",
        textAlign: "center",
        opacity: earned ? 1 : 0.4
      }},
        React.createElement("i", {className:"ti ti-" + (earned ? "trophy" : "lock"), style:{color:earned ? tierColor : "#4A5568",fontSize:18,display:"block",marginBottom:4}}),
        React.createElement("div", {style:{fontSize:10,fontWeight:700,color:earned ? "#F2EDE4" : "#6B7B8F"}}, ach.name),
        React.createElement("div", {style:{fontSize:8,color:"#9AAABF",marginTop:2}}, ach.desc)
      );
    })
  )
)
```

- [ ] **Step 4: Wire achievement evaluation to post-clash flow**

After clash results are confirmed (in admin panel result approval), evaluate and persist:

```javascript
function checkAndGrantAchievements(player) {
  supabase.from("player_achievements").select("achievement_id").eq("player_id", player.id)
    .then(function(res) {
      var existing = res.data || [];
      var newAchs = evaluateAchievements(player, existing);
      if (newAchs.length > 0) {
        var inserts = newAchs.map(function(achId) {
          return {player_id: player.id, achievement_id: achId};
        });
        supabase.from("player_achievements").insert(inserts).then(function(r) {
          if (!r.error) {
            // Also insert activity feed events
            newAchs.forEach(function(achId) {
              var achDef = ACHIEVEMENTS.find(function(a){return a.id === achId;});
              supabase.from("activity_feed").insert({
                type: "achievement",
                player_id: player.id,
                detail_json: {text: player.name + " earned " + (achDef ? achDef.name : achId)}
              });
            });
          }
        });
      }
    });
}
```

- [ ] **Step 5: Build check + brace balance**

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: achievement system with DB persistence and profile display"
```

---

### Task 12: Onboarding Flow

**Files:**
- Modify: `src/App.jsx` - new OnboardingFlow component + modify SignUpScreen

**Context:** 4-screen cinematic onboarding. Spec Section 18.

- [ ] **Step 1: Add REGIONS constant (if not already present)**

Check if `REGIONS` exists in App.jsx. If not, add near other constants (around line 100):

```javascript
var REGIONS = ["EUW", "EUNE", "NA", "KR", "JP", "BR", "LAN", "LAS", "OCE", "TR", "RU", "PH", "SG", "TH", "TW", "VN"];
```

- [ ] **Step 2: Simplify SignUpScreen to credentials-only**

In `SignUpScreen` (line 12777), remove the 2-step form. Keep only: email, username, password. Remove Riot ID and region fields from signup (these move to onboarding Screen 2). The signup should be as fast as possible.

- [ ] **Step 3: Add OnboardingFlow component**

Add before the root TFTClash component:

```javascript
function OnboardingFlow(props) {
  var currentUser = props.currentUser;
  var onComplete = props.onComplete;
  var onRegister = props.onRegister;
  var nextClash = props.nextClash;
  var playerCount = props.playerCount || 0;

  var _step = useState(1);
  var step = _step[0];
  var setStep = _step[1];
  var _riotId = useState("");
  var riotId = _riotId[0];
  var setRiotId = _riotId[1];
  var _region = useState("EUW");
  var region = _region[0];
  var setRegion = _region[1];
  var _linking = useState(false);
  var linking = _linking[0];
  var setLinking = _linking[1];

  // Auto-advance welcome screen after 3 seconds
  useEffect(function() {
    if (step === 1) {
      var t = setTimeout(function() { setStep(2); }, 3500);
      return function() { clearTimeout(t); };
    }
  }, [step]);

  // Screen 1: Welcome cinematic
  if (step === 1) {
    return React.createElement("div", {style:{position:"fixed",inset:0,background:"#08080F",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:10000,textAlign:"center",padding:32}},
      React.createElement("div", {style:{fontSize:14,color:"#E8A838",fontWeight:700,opacity:1,animation:"fadeIn 1s ease"}},
        "Welcome, " + (currentUser ? currentUser.username : "Player") + "."
      ),
      React.createElement("div", {style:{fontSize:13,color:"#C8D4E0",marginTop:16,opacity:1,animation:"fadeIn 2s ease"}},
        "Your story starts now."
      ),
      React.createElement("div", {style:{marginTop:32,opacity:1,animation:"fadeIn 3s ease"}},
        React.createElement(Btn, {v:"primary",onClick:function(){setStep(2);}}, "Enter the Arena")
      )
    );
  }

  // Screen 2: Link Riot ID
  if (step === 2) {
    return React.createElement("div", {style:{position:"fixed",inset:0,background:"#08080F",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:10000,padding:32}},
      React.createElement("div", {style:{maxWidth:360,width:"100%",textAlign:"center"}},
        React.createElement("h2", {className:"display",style:{color:"#F2EDE4",marginBottom:8}}, "Link Your Riot ID"),
        React.createElement("p", {style:{fontSize:13,color:"#BECBD9",marginBottom:24}}, "So we can track your placements and build your legacy."),
        React.createElement(Inp, {placeholder:"Name#TAG",value:riotId,onChange:function(e){setRiotId(e.target.value);},style:{marginBottom:12,textAlign:"center"}}),
        React.createElement("select", {value:region,onChange:function(e){setRegion(e.target.value);},style:{width:"100%",padding:"10px 14px",borderRadius:10,background:"#1A2235",border:"1px solid rgba(255,255,255,.1)",color:"#F2EDE4",fontSize:13,marginBottom:16}},
          REGIONS.map(function(r) { return React.createElement("option", {key:r,value:r}, r); })
        ),
        React.createElement(Btn, {v:"primary",full:true,disabled:linking,onClick:function(){
          if (!riotId.includes("#")) return;
          setLinking(true);
          supabase.from("user_profiles").update({riot_id:riotId,region:region}).eq("user_id",currentUser.id).then(function() {
            setLinking(false);
            setStep(3);
          });
        }}, linking ? "Linking..." : "Link Account"),
        React.createElement("div", {style:{marginTop:12}},
          React.createElement("span", {style:{fontSize:12,color:"#6B7B8F",cursor:"pointer"},onClick:function(){setStep(3);}}, "Skip for now")
        )
      )
    );
  }

  // Screen 3: Player card preview
  if (step === 3) {
    return React.createElement("div", {style:{position:"fixed",inset:0,background:"#08080F",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:10000,padding:32}},
      React.createElement("div", {style:{maxWidth:320,width:"100%",background:"#111827",border:"1px solid rgba(155,114,207,.3)",borderRadius:16,padding:"24px 20px",textAlign:"center"}},
        React.createElement("div", {style:{fontSize:10,fontWeight:700,color:"#9AAABF",textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}, "Unranked"),
        React.createElement("div", {style:{fontSize:20,fontWeight:700,color:"#F2EDE4",marginBottom:4}}, currentUser ? currentUser.username : "Player"),
        riotId ? React.createElement("div", {style:{fontSize:12,color:"#BECBD9",marginBottom:12}}, riotId + " - " + region) : null,
        React.createElement("div", {style:{fontSize:12,color:"#9AAABF",marginBottom:4}}, "0 pts - 0 clashes"),
        React.createElement("div", {style:{borderTop:"1px solid rgba(255,255,255,.08)",paddingTop:12,marginTop:12}},
          nextClash ? React.createElement("div", {style:{fontSize:12,color:"#BECBD9",marginBottom:12}}, "Next Clash: " + nextClash) : null,
          React.createElement("div", {style:{fontSize:11,fontStyle:"italic",color:"#9B72CF",marginBottom:16}}, "Every champion started here.")
        ),
        React.createElement("div", {style:{display:"flex",gap:8,justifyContent:"center"}},
          React.createElement(Btn, {v:"dark",s:"sm",onClick:function(){onComplete();}}, "See the Leaderboard"),
          onRegister ? React.createElement(Btn, {v:"primary",s:"sm",onClick:function(){onRegister();onComplete();}}, "Register") : null
        )
      )
    );
  }

  return null;
}
```

- [ ] **Step 4: Wire OnboardingFlow into root TFTClash**

Add state and rendering:

```javascript
var _onb = useState(false);
var showOnboarding = _onb[0];
var setShowOnboarding = _onb[1];
```

In the auth callback (after successful signup), set `setShowOnboarding(true)`.

Before the main screen render:

```javascript
showOnboarding ? React.createElement(OnboardingFlow, {
  currentUser: currentUser,
  onComplete: function() { setShowOnboarding(false); },
  onRegister: function() { /* trigger registration */ },
  nextClash: tournamentState.clashDate || "Saturday",
  playerCount: players.length
}) : null
```

- [ ] **Step 5: Build check + brace balance**

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: cinematic onboarding flow - welcome, Riot ID link, player card"
```

---

### Task 13: Activity Feed Writer (Populate Feed on Key Events)

**Files:**
- Modify: `src/App.jsx` - add activity feed inserts at key event points

**Context:** The activity feed needs data. Insert events when: registration, result confirmation, rank changes. Spec Section 4, Zone 3.

- [ ] **Step 1: Add writeActivityEvent helper**

```javascript
function writeActivityEvent(type, playerId, text) {
  supabase.from("activity_feed").insert({
    type: type,
    player_id: playerId,
    detail_json: {text: text}
  }).then(function(r) {
    if (r.error) console.error("[TFT] activity_feed insert failed:", r.error);
  });
}
```

- [ ] **Step 2: Insert events at key points**

In `registerFromAccount()`, after successful registration:
```javascript
writeActivityEvent("registration", linkedPlayer.id, currentUser.username + " registered for " + clashName);
```

In result confirmation flow, after results are approved:
```javascript
writeActivityEvent("result", winnerId, winnerName + " won " + clashName);
```

In the post-clash processing (when positions change):
```javascript
writeActivityEvent("rank_change", player.id, player.name + " moved to #" + newRank);
```

- [ ] **Step 3: Build check + brace balance**

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: activity feed writer - populate feed on registration, results, rank changes"
```

---

## Phase 3: Community & Tools (Tasks 14-17)

After this phase: scrims persist to DB with full stats, broadcast/OBS mode works, Twitter sharing works.

---

### Task 14: Scrims Screen with Full DB Persistence

**Files:**
- Modify: `src/App.jsx` - `ScrimsScreen()` (line 10698)

**Context:** Rebuild scrims to read/write from Supabase tables: scrims, scrim_players, scrim_games, scrim_results. Spec Section 10.

- [ ] **Step 1: Add scrim CRUD functions before ScrimsScreen**

```javascript
function createScrim(name, playerIds, createdBy, tag) {
  return supabase.from("scrims").insert({
    name: name, created_by: createdBy, tag: tag || null, status: "active"
  }).select().single().then(function(res) {
    if (res.error) return res;
    var scrimId = res.data.id;
    var playerRows = playerIds.map(function(pid) {
      return {scrim_id: scrimId, player_id: pid};
    });
    return supabase.from("scrim_players").insert(playerRows).then(function() {
      return res;
    });
  });
}

function submitScrimResult(scrimId, gameNumber, results) {
  return supabase.from("scrim_games").insert({
    scrim_id: scrimId, game_number: gameNumber, status: "completed"
  }).select().single().then(function(res) {
    if (res.error) return res;
    var gameId = res.data.id;
    var rows = results.map(function(r) {
      return {scrim_game_id: gameId, player_id: r.playerId, placement: r.placement, points: PTS[r.placement] || 0};
    });
    return supabase.from("scrim_results").insert(rows);
  });
}

function loadScrims(userId) {
  // Only load scrims the user participates in (via scrim_players)
  return supabase.from("scrims").select("*, scrim_players!inner(player_id), scrim_games(*, scrim_results(*))")
    .eq("scrim_players.player_id", userId)
    .order("created_at", {ascending: false})
    .limit(20);
}
```

- [ ] **Step 2: Replace ScrimsScreen state and data loading**

At the top of the existing `ScrimsScreen` function, replace all local mock state with DB-backed state:

```javascript
var _scrims = useState([]);
var scrims = _scrims[0];
var setScrims = _scrims[1];
var _selScrim = useState(null);
var selectedScrim = _selScrim[0];
var setSelectedScrim = _selScrim[1];
var _showCreate = useState(false);
var showCreate = _showCreate[0];
var setShowCreate = _showCreate[1];
var _scrimName = useState("");
var scrimName = _scrimName[0];
var setScrimName = _scrimName[1];
var _scrimTag = useState("");
var scrimTag = _scrimTag[0];
var setScrimTag = _scrimTag[1];
var _selectedPlayers = useState([]);
var selectedPlayers = _selectedPlayers[0];
var setSelectedPlayers = _selectedPlayers[1];
var _loading = useState(true);
var loading = _loading[0];
var setLoading = _loading[1];

useEffect(function() {
  if (linkedPlayer) {
    loadScrims(linkedPlayer.id).then(function(res) {
      if (res.data) setScrims(res.data);
      setLoading(false);
    });
  }
}, [linkedPlayer]);
```

- [ ] **Step 3: Replace ScrimsScreen render with DB-backed UI**

Replace the return statement of ScrimsScreen. The new render has 3 sections: scrim list, create modal, and detail view:

```javascript
return React.createElement("div", {className: "page wrap fade-up"},
  // Header with create button
  React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}},
    React.createElement("h2", {className:"display",style:{fontSize:22,color:"#F2EDE4"}}, "Scrims"),
    isAdmin ? React.createElement(Btn, {v:"primary",s:"sm",onClick:function(){setShowCreate(true);}}, "New Scrim") : null
  ),
  // Create scrim modal
  showCreate ? React.createElement("div", {style:{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999},onClick:function(){setShowCreate(false);}},
    React.createElement("div", {style:{background:"#111827",border:"1px solid rgba(155,114,207,.3)",borderRadius:16,padding:24,maxWidth:400,width:"90%"},onClick:function(e){e.stopPropagation();}},
      React.createElement("h3", {style:{fontSize:16,fontWeight:700,color:"#F2EDE4",marginBottom:16}}, "Create Scrim"),
      React.createElement(Inp, {value:scrimName,onChange:function(e){setScrimName(e.target.value);},placeholder:"Scrim name",style:{marginBottom:8}}),
      React.createElement(Inp, {value:scrimTag,onChange:function(e){setScrimTag(e.target.value);},placeholder:"Tag (optional)",style:{marginBottom:12}}),
      React.createElement("div", {style:{fontSize:11,color:"#9AAABF",marginBottom:8,fontWeight:600}}, "Select Players"),
      React.createElement("div", {style:{maxHeight:200,overflowY:"auto",marginBottom:12}},
        players.map(function(p) {
          var checked = selectedPlayers.indexOf(p.id) !== -1;
          return React.createElement("label", {key:p.id,style:{display:"flex",alignItems:"center",gap:8,padding:"4px 0",cursor:"pointer",fontSize:13,color:"#BECBD9"}},
            React.createElement("input", {type:"checkbox",checked:checked,onChange:function(){
              if (checked) setSelectedPlayers(selectedPlayers.filter(function(id){return id !== p.id;}));
              else setSelectedPlayers(selectedPlayers.concat([p.id]));
            }}),
            p.name
          );
        })
      ),
      React.createElement("div", {style:{display:"flex",gap:8}},
        React.createElement(Btn, {v:"primary",s:"sm",onClick:function(){
          if (!scrimName.trim()) return;
          createScrim(scrimName, selectedPlayers, currentUser.id, scrimTag || null).then(function(res) {
            if (!res.error) {
              setShowCreate(false);
              setScrimName("");
              setScrimTag("");
              setSelectedPlayers([]);
              loadScrims(linkedPlayer.id).then(function(r){if(r.data) setScrims(r.data);});
            }
          });
        }}, "Create"),
        React.createElement(Btn, {v:"dark",s:"sm",onClick:function(){setShowCreate(false);}}, "Cancel")
      )
    )
  ) : null,
  // Scrim list
  loading ? React.createElement("div", {style:{color:"#9AAABF",textAlign:"center",padding:40}}, "Loading scrims...") :
  scrims.length === 0 ? React.createElement("div", {style:{color:"#9AAABF",textAlign:"center",padding:40}}, "No scrims yet. Create one to get started.") :
  React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:8}},
    scrims.map(function(scrim) {
      var gameCount = scrim.scrim_games ? scrim.scrim_games.length : 0;
      var playerCount = scrim.scrim_players ? scrim.scrim_players.length : 0;
      return React.createElement(Panel, {key:scrim.id,style:{padding:"14px 16px",cursor:"pointer",border:selectedScrim && selectedScrim.id === scrim.id ? "1px solid rgba(155,114,207,.5)" : undefined},onClick:function(){setSelectedScrim(scrim);}},
        React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
          React.createElement("div", null,
            React.createElement("div", {style:{fontSize:14,fontWeight:700,color:"#F2EDE4"}}, scrim.name),
            React.createElement("div", {style:{fontSize:11,color:"#9AAABF",marginTop:2}}, playerCount + " players, " + gameCount + " games")
          ),
          React.createElement("div", {style:{fontSize:10,color:scrim.status === "active" ? "#6EE7B7" : "#9AAABF",fontWeight:600,textTransform:"uppercase"}}, scrim.status)
        )
      );
    })
  ),
  // Selected scrim detail - standings + per-game results
  selectedScrim ? React.createElement("div", {style:{marginTop:20}},
    React.createElement("h3", {style:{fontSize:16,fontWeight:700,color:"#F2EDE4",marginBottom:12}}, selectedScrim.name + " - Standings"),
    // Compute scrim standings from results
    function() {
      // NOTE: Do NOT use this IIFE pattern in JSX. Precompute scrimStandings before return.
    }
  ) : null
);
```

**IMPORTANT:** The selected scrim detail section requires pre-computing scrim standings BEFORE the return statement. Add this computation after the state variables:

```javascript
// Pre-compute scrim standings for selected scrim
var scrimStandings = [];
if (selectedScrim && selectedScrim.scrim_games) {
  var scrimPtsMap = {};
  selectedScrim.scrim_games.forEach(function(game) {
    (game.scrim_results || []).forEach(function(r) {
      if (!scrimPtsMap[r.player_id]) scrimPtsMap[r.player_id] = {id:r.player_id,pts:0,games:0,wins:0};
      scrimPtsMap[r.player_id].pts += r.points;
      scrimPtsMap[r.player_id].games += 1;
      if (r.placement === 1) scrimPtsMap[r.player_id].wins += 1;
    });
  });
  scrimStandings = Object.keys(scrimPtsMap).map(function(pid) {
    var entry = scrimPtsMap[pid];
    var p = players.find(function(pl){return pl.id === parseInt(pid);});
    return {name: p ? p.name : "Unknown", pts: entry.pts, games: entry.games, wins: entry.wins};
  }).sort(function(a,b){return b.pts - a.pts;});
}
```

Then in the detail section replace the IIFE with a simple map over `scrimStandings`.

- [ ] **Step 3: Build check + brace balance**

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: scrims with full Supabase persistence - create, results, standings"
```

---

### Task 15: Broadcast/OBS Mode

**Files:**
- Modify: `src/App.jsx` - add BroadcastOverlay component + route handler

**Context:** Net-new feature. A chromeless standings view at `#broadcast` for OBS Browser Source. Spec Section 15.

- [ ] **Step 1: Add BroadcastOverlay component**

Add before root TFTClash:

```javascript
function BroadcastOverlay(props) {
  var tournamentState = props.tournamentState;
  var players = props.players;
  var params = props.params || {};
  var type = params.type || "standings";
  var bg = params.bg || "dark";
  var size = params.size || "compact";

  var sorted = [].concat(players).sort(function(a,b){return b.pts - a.pts;});
  var bgColor = bg === "transparent" ? "transparent" : "#08080F";

  if (type === "standings") {
    return React.createElement("div", {style:{background:bgColor,padding:size === "compact" ? 12 : 20,fontFamily:"Inter,system-ui,sans-serif",minHeight:"100vh"}},
      // Header
      React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}},
        React.createElement("div", {style:{fontSize:11,fontWeight:700,color:"#9B72CF",textTransform:"uppercase",letterSpacing:".1em"}}, tournamentState.clashName || "TFT Clash"),
        tournamentState.phase === "inprogress" ? React.createElement("div", {style:{display:"flex",alignItems:"center",gap:4}},
          React.createElement("div", {style:{width:6,height:6,borderRadius:"50%",background:"#52C47C",animation:"pulse 2s infinite"}}),
          React.createElement("span", {style:{fontSize:11,fontWeight:700,color:"#6EE7B7"}}, "LIVE - Game " + (tournamentState.round || 1) + "/" + (tournamentState.totalGames || 3))
        ) : null
      ),
      // Standings rows
      sorted.slice(0, 24).map(function(p, i) {
        return React.createElement("div", {key:p.id,style:{display:"flex",alignItems:"center",gap:8,padding:size === "compact" ? "4px 8px" : "8px 12px",borderBottom:"1px solid rgba(255,255,255,.06)",background:i < 3 ? "rgba(232,168,56,.04)" : "transparent"}},
          React.createElement("span", {style:{width:24,textAlign:"right",fontSize:13,fontWeight:700,color:i === 0 ? "#E8A838" : i < 3 ? "#C0C0C0" : "#9AAABF"}}, i+1),
          React.createElement("span", {style:{flex:1,fontSize:13,fontWeight:600,color:"#F2EDE4"}}, p.name),
          React.createElement("span", {style:{fontSize:13,fontWeight:700,color:"#E8A838",fontFamily:"monospace"}}, p.pts)
        );
      }),
      // Watermark
      React.createElement("div", {style:{textAlign:"right",marginTop:8,fontSize:8,color:"rgba(155,114,207,.4)",letterSpacing:".1em"}}, "TFT CLASH")
    );
  }

  // Lobby cards type
  if (type === "lobbies" && tournamentState.lobbies) {
    return React.createElement("div", {style:{background:bgColor,padding:12,fontFamily:"Inter,system-ui,sans-serif"}},
      React.createElement("div", {style:{fontSize:11,fontWeight:700,color:"#E8A838",textTransform:"uppercase",marginBottom:8}}, "Lobby Assignments"),
      React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}},
        (tournamentState.lobbies || []).map(function(lobby, li) {
          return React.createElement("div", {key:li,style:{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(255,255,255,.08)"}},
            React.createElement("div", {style:{fontSize:10,fontWeight:700,color:"#9B72CF",marginBottom:4}}, lobby.name || "Lobby " + (li+1)),
            (lobby.players || []).map(function(pid) {
              var p = players.find(function(pl){return String(pl.id) === String(pid);});
              return React.createElement("div", {key:pid,style:{fontSize:11,color:"#BECBD9",padding:"2px 0"}}, p ? p.name : "Player " + pid);
            })
          );
        })
      )
    );
  }

  return React.createElement("div", {style:{background:bgColor,padding:20,color:"#9AAABF",fontSize:13}}, "No data available");
}
```

- [ ] **Step 2: Add #broadcast route handling in root**

In the screen rendering section (line ~18670), add a broadcast route:

```javascript
// Before the normal screen rendering
if (screen === "broadcast") {
  var bParams = {};
  var hashParts = (window.location.hash || "").split("?");
  if (hashParts[1]) {
    hashParts[1].split("&").forEach(function(kv) {
      var parts = kv.split("=");
      bParams[parts[0]] = parts[1] || "";
    });
  }
  return React.createElement(BroadcastOverlay, {
    tournamentState: tournamentState,
    players: players,
    params: bParams
  });
}
```

Also add "broadcast" to the route mapping so `#broadcast` sets `screen = "broadcast"`.

- [ ] **Step 3: Build check + brace balance**

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: broadcast/OBS overlay mode at #broadcast route"
```

---

### Task 16: Twitter/X Share System

**Files:**
- Modify: `src/App.jsx` - add share helper + buttons on results/profile/recap

**Context:** Generate Twitter intent URLs with pre-filled text. OG cards deferred to Edge Function later. Spec Section 14.

- [ ] **Step 1: Add shareToTwitter helper**

```javascript
function shareToTwitter(text) {
  var encoded = encodeURIComponent(text);
  window.open("https://twitter.com/intent/tweet?text=" + encoded, "_blank", "width=550,height=420");
}

function buildShareText(type, data) {
  if (type === "result") {
    return "Finished " + ordinal(data.placement) + " in " + data.clashName + " - " + data.points + " season pts on TFT Clash";
  }
  if (type === "profile") {
    return data.name + " - Rank #" + data.rank + " with " + data.pts + " pts on TFT Clash";
  }
  if (type === "recap") {
    return data.winner + " won " + data.clashName + "! Full recap on TFT Clash";
  }
  return "Competing on TFT Clash - the competitive TFT platform";
}
```

- [ ] **Step 2: Add share buttons to Results phase, Profile, and Recap**

In ClashScreen results phase, after the standings:
```javascript
React.createElement(Btn, {v:"dark",s:"sm",onClick:function(){
  shareToTwitter(buildShareText("result", {placement:myPlacement,clashName:tournamentState.clashName,points:linkedPlayer.pts}));
}}, "Share to Twitter")
```

Similar buttons on AccountScreen and in ClashRecap component.

- [ ] **Step 3: Build check + brace balance**

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: Twitter share system with intent URLs for results, profiles, recaps"
```

---

### Task 17: Events Screen Tab Reorder (Featured Default)

**Files:**
- Modify: `src/App.jsx` - `EventsScreen()` (line 4006)

**Context:** Change default tab from Archive to Featured. Spec Section 8, note about overriding UX overhaul spec.

- [ ] **Step 1: Update EventsScreen default tab**

In the EventsScreen function, find the tab state initialization and change default from "archive" to "featured":

```javascript
var _tab = useState("featured"); // was "archive"
```

Reorder the tabs array so Featured is first:

```javascript
var tabs = [
  {id:"featured",label:"Featured"},
  {id:"archive",label:"Archive"},
  {id:"tournaments",label:"Tournaments"}
];
```

- [ ] **Step 2: Update hash route mapping**

In the route redirect logic, ensure `#events` maps to the Featured tab (no sub-route needed since it's default).

- [ ] **Step 3: Build check**

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: events screen defaults to Featured tab"
```

---

## Phase 4: Admin, Polish & Remaining Screens (Tasks 18-22)

After this phase: admin panel fully functional, rules/FAQ restructured, all screens polished, em-dash audit complete.

---

### Task 18: Admin Panel - Full Working Controls

**Files:**
- Modify: `src/App.jsx` - `AdminPanel()` (line 8936)

**Context:** Every admin control must execute real DB operations. Spec Section 16. The admin panel already exists but may have placeholder buttons.

- [ ] **Step 1: Audit existing admin controls for functionality**

Read through AdminPanel (line 8936+) and catalog which controls actually write to Supabase vs which are placeholder.

- [ ] **Step 2: Wire all non-functional controls to Supabase**

For each control that is currently a placeholder, implement the DB operation:
- Tournament creation: `supabase.from("tournaments").insert(...)`
- Phase advancement: `supabase.from("tournaments").update({phase: newPhase}).eq("id", tid)`
- Result approval: `supabase.from("clash_games").update({status: "confirmed"}).eq("id", gid)`
- Player management: full CRUD on `players` table
- Season management: CRUD on `seasons` table
- Announcements: `supabase.from("announcements").insert(...)`
- Tier assignment: `supabase.from("user_subscriptions").upsert(...)`
- Audit logging: every admin action writes to `admin_audit_log`

- [ ] **Step 3: Add audit logging wrapper**

```javascript
function adminAction(adminId, action, targetTable, targetId, detail) {
  return supabase.from("admin_audit_log").insert({
    admin_id: adminId,
    action: action,
    target_table: targetTable,
    target_id: String(targetId || ""),
    detail_json: detail || {}
  });
}
```

Wrap every admin operation with an audit log call.

- [ ] **Step 4: Build check + brace balance**

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: admin panel fully wired to Supabase with audit logging"
```

---

### Task 19: Rules Screen Restructure

**Files:**
- Modify: `src/App.jsx` - `RulesScreen()` (line 17171)

**Context:** Structured accordion with quick reference card and search. Spec Section 12.

- [ ] **Step 1: Define rules data structure**

```javascript
var RULES_SECTIONS = [
  {id:"format",title:"Tournament Format",icon:"tournament",content:"Weekly Saturday clashes with 3-5 games per session. 8 players per lobby. Standard EMEA scoring."},
  {id:"points",title:"Points System",icon:"chart-bar",content:"1st: 8 pts, 2nd: 7 pts, 3rd: 6 pts, 4th: 5 pts, 5th: 4 pts, 6th: 3 pts, 7th: 2 pts, 8th: 1 pt",isPointsTable:true},
  {id:"tiebreakers",title:"Tiebreakers",icon:"arrows-sort",content:"1. Total tournament points. 2. Wins + top 4s (wins count twice). 3. Most of each placement (1st, then 2nd, then 3rd...). 4. Most recent game finish."},
  {id:"registration",title:"Registration and Check-in",icon:"clipboard-check",content:"Register anytime before the clash. Check-in opens 60 minutes before start and closes at start time. No-shows lose their spot to the next waitlisted player."},
  {id:"results",title:"Result Submission",icon:"send",content:"Any player in a lobby can submit results. A different player must confirm. If disputed, an admin reviews. Admin can always override."},
  {id:"swiss",title:"Swiss Reseeding",icon:"refresh",content:"When Swiss mode is enabled, lobbies are reseeded after every 2 games. Players are sorted by cumulative points and snake-seeded into new lobbies."},
  {id:"conduct",title:"Code of Conduct",icon:"shield",content:"Respectful behavior is required. Intentional disconnects, collusion, or abusive communication may result in warnings, temporary bans, or permanent removal."},
  {id:"disputes",title:"Disputes and Appeals",icon:"gavel",content:"Click Dispute on any result submission to flag it for admin review. Admins will review within 24 hours. Decisions are final."}
];
```

- [ ] **Step 2: Rewrite RulesScreen with accordion and search**

Implement:
- Search input at top
- Quick reference card with 3 key facts
- Collapsible accordion sections
- Points table with color-coded cells
- Filter sections based on search query

- [ ] **Step 3: Build check + brace balance**

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: rules screen with accordion, search, and quick reference card"
```

---

### Task 20: FAQ Screen Restructure

**Files:**
- Modify: `src/App.jsx` - `FAQScreen()` (line 17292)

**Context:** Grouped accordion with search. Spec Section 13.

- [ ] **Step 1: Define FAQ data and rewrite screen**

Similar pattern to rules: structured data array, grouped by category, accordion expand/collapse, search filter. Add "Still have questions?" CTA at bottom.

- [ ] **Step 2: Build check + brace balance**

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: FAQ screen with categorized accordion and search"
```

---

### Task 21: Em-Dash Audit and Removal

**Files:**
- Modify: `src/App.jsx` - find and replace all em/en dashes in user-facing strings

**Context:** ZERO em dashes or en dashes anywhere in rendered content. This is non-negotiable.

- [ ] **Step 1: Search for all em dashes and en dashes in App.jsx**

Run: `grep -n "\u2014\|\u2013" src/App.jsx` (or equivalent search for the actual characters)

Also search for the HTML entities: `&mdash;`, `&ndash;`, `&#8212;`, `&#8211;`

- [ ] **Step 2: Replace every instance**

Replace with hyphens `-`, commas, periods, or rewrite the sentence. Common patterns:
- "Registration Open - 12/24 registered" (use hyphen)
- "Play, Submit, Win" (use commas)
- "Your spot is reserved. Check-in opens soon." (use period to split)

- [ ] **Step 3: Verify zero remaining**

Run the search again. Expected: 0 matches.

- [ ] **Step 4: Build check**

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "fix: remove all em dashes and en dashes from user-facing content"
```

---

### Task 22: Animation Pass and Mobile Responsive Polish

**Files:**
- Modify: `src/App.jsx` - add CSS classes and responsive adjustments

**Context:** Final polish. Count-up animations on stats, stagger-in on table rows, card hover effects, mobile breakpoints. Spec Section 2.

- [ ] **Step 1: Add count-up animation CSS**

In the style tag (NOT the GCSS template literal), add:

```css
@keyframes countUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.count-up { animation: countUp 0.4s ease-out forwards; }
```

- [ ] **Step 2: Add stagger-in for table rows**

```css
.stagger-row { animation: fadeIn 0.3s ease-out forwards; opacity: 0; }
```

Apply to standings table rows with increasing animation-delay.

- [ ] **Step 3: Verify mobile responsive behavior**

Test at 768px and 480px breakpoints:
- Home zones stack vertically
- Stats grid goes 2-column then 1-column
- Standings table transforms appropriately
- Tabs are swipeable
- Touch targets are 44px minimum

- [ ] **Step 4: Build check + brace balance**

- [ ] **Step 5: Final full verification**

Run: `npx vite build` - must succeed.
Run: `npx vite dev` - spot check all screens.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: animation pass and mobile responsive polish"
```

---

## Phase 5: Remaining Screens & Features (Tasks 23-30)

Covers all spec sections not addressed in Phases 1-4: Clash Screen enhancements, Host Dashboard, Gear Screen, Privacy/Terms, More Menu, Season Recap, Email Digest, and Broadcast real-time.

---

### Task 23: Clash Screen Enhancements (Registration, Live, Results Phases)

**Files:**
- Modify: `src/App.jsx` - `ClashScreen()` (line 3927) and related phase render functions

**Context:** Spec Section 9. The phase-adaptive ClashScreen needs content upgrades: registration phase scouting (mini profiles of registered players), live phase row animations and round tracker, results phase animated reveal with per-game breakdown and awards.

- [ ] **Step 1: Enhance registration phase with player scouting cards**

In the ClashScreen registration phase render, replace the plain player list with scouting cards showing each registered player's rank, sparkline, and recent form:

```javascript
// Inside registration phase rendering
// For each registered player, show a mini card
registeredPlayers.map(function(p) {
  var pStats = getStats(p);
  var recentForm = (p.clashHistory || []).slice(-5).map(function(c){return c.placement;});
  return React.createElement("div", {key:p.id,style:{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)"}},
    React.createElement("div", {style:{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,rgba(155,114,207,.2),rgba(155,114,207,.08))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#C4B5FD"}}, "#" + (players.indexOf(p) + 1)),
    React.createElement("div", {style:{flex:1}},
      React.createElement("div", {style:{fontSize:13,fontWeight:700,color:"#F2EDE4"}}, p.name),
      React.createElement("div", {style:{fontSize:10,color:"#9AAABF"}}, (pStats.avgPlacement ? pStats.avgPlacement.toFixed(1) + " avg" : "New") + " - " + (p.wins || 0) + " wins")
    ),
    React.createElement(Sparkline, {data:recentForm, width:40, height:14, color:"#9B72CF"})
  );
})
```

- [ ] **Step 2: Enhance live phase with round tracker and row animations**

Add a round progress tracker at the top of the live phase:

```javascript
// Round progress indicator
React.createElement("div", {style:{display:"flex",gap:4,marginBottom:16,justifyContent:"center"}},
  Array.from({length: tournamentState.totalGames || 3}, function(_, i) {
    var isComplete = i + 1 < tRound;
    var isCurrent = i + 1 === tRound;
    return React.createElement("div", {key:i,style:{width:isCurrent ? 24 : 8,height:8,borderRadius:4,background:isComplete ? "#6EE7B7" : isCurrent ? "#E8A838" : "rgba(255,255,255,.1)",transition:"all .3s ease"}});
  })
)
```

Add stagger animation class to live standings rows (animation-delay based on index).

- [ ] **Step 3: Enhance results phase with awards and per-game breakdown**

After results are shown, compute and display awards:

```javascript
// Pre-compute awards before return
var clashAwards = [];
if (tournamentState.phase === "complete" && tournamentState.results) {
  var results = tournamentState.results;
  // Comeback King: biggest improvement from game 1 to final
  // Iron Wall: most consistent placements
  // Clutch Factor: best final game placement
  // These are computed from game-by-game data
}
```

Display awards as small badge cards below the final standings.

- [ ] **Step 4: Build check + brace balance**

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: clash screen enhancements - scouting cards, round tracker, awards"
```

---

### Task 24: Host Dashboard Enhancements

**Files:**
- Modify: `src/App.jsx` - `HostDashboardScreen()` (line 14833) and `HostApplyScreen()` (line 14677)

**Context:** Spec Section 17. Host Dashboard needs: tournament creation wizard, branding controls (logo upload to Supabase Storage), analytics, and player management scoped to host's tournaments.

- [ ] **Step 1: Add tournament creation wizard to HostDashboardScreen**

Add a multi-step creation flow. Step 1: name + date. Step 2: format (standard/Swiss) + game count + max players. Step 3: branding (logo, accent color). Step 4: review + create.

```javascript
// Creation wizard state
var _wizStep = useState(0);
var wizStep = _wizStep[0];
var setWizStep = _wizStep[1];
var _wizData = useState({name:"",date:"",type:"standard",totalGames:3,maxPlayers:16,accentColor:"#9B72CF"});
var wizData = _wizData[0];
var setWizData = _wizData[1];

// On final step, insert to tournaments table with host_id
function createHostTournament() {
  return supabase.from("tournaments").insert({
    name: wizData.name,
    date: wizData.date,
    type: wizData.type,
    total_games: wizData.totalGames,
    max_players: wizData.maxPlayers,
    host_id: currentUser.id,
    branding_json: {accent_color: wizData.accentColor, logo_url: wizData.logoUrl || null}
  }).select().single();
}
```

- [ ] **Step 2: Add branding controls with Supabase Storage upload**

```javascript
// Logo upload handler
function handleLogoUpload(file) {
  var path = "host-logos/" + currentUser.id + "/" + file.name;
  return supabase.storage.from("host-assets").upload(path, file, {upsert: true}).then(function(res) {
    if (!res.error) {
      var url = supabase.storage.from("host-assets").getPublicUrl(path).data.publicUrl;
      return supabase.from("host_profiles").update({logo_url: url}).eq("user_id", currentUser.id);
    }
  });
}
```

Add a file input for logo and a color picker for accent color in the branding section.

- [ ] **Step 3: Add host analytics section**

Show participation trends and player counts for the host's tournaments:

```javascript
// Load host tournament stats
var _hostStats = useState(null);
useEffect(function() {
  supabase.from("tournaments").select("id, name, date, registrations(count)").eq("host_id", currentUser.id)
    .order("date", {ascending: false}).then(function(res) {
      if (res.data) setHostStats(res.data);
    });
}, []);
```

- [ ] **Step 4: Build check + brace balance**

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: host dashboard - tournament wizard, branding, analytics"
```

---

### Task 25: Gear Screen with DB-Backed Products

**Files:**
- Modify: `src/App.jsx` - `GearScreen()` (line 17387)

**Context:** Spec Section 20. Grid of product cards from `gear_items` table. Admin can manage items.

- [ ] **Step 1: Rewrite GearScreen to load from DB**

```javascript
function GearScreen(props) {
  var isAdmin = props.isAdmin;
  var _items = useState([]);
  var items = _items[0];
  var setItems = _items[1];
  var _loading = useState(true);

  useEffect(function() {
    supabase.from("gear_items").select("*").order("sort_order").then(function(res) {
      if (res.data) setItems(res.data);
      _loading[1](false);
    });
  }, []);

  var categories = [];
  items.forEach(function(item) {
    if (categories.indexOf(item.category) === -1) categories.push(item.category);
  });

  return React.createElement("div", {className: "page wrap fade-up"},
    React.createElement("h2", {className:"display",style:{fontSize:22,color:"#F2EDE4",marginBottom:20}}, "Gear"),
    _loading[0] ? React.createElement("div", {style:{color:"#9AAABF",textAlign:"center",padding:40}}, "Loading...") :
    items.length === 0 ? React.createElement("div", {style:{color:"#9AAABF",textAlign:"center",padding:40}}, "Coming soon.") :
    categories.map(function(cat) {
      var catItems = items.filter(function(i){return i.category === cat;});
      return React.createElement("div", {key:cat,style:{marginBottom:24}},
        React.createElement("div", {className:"cond",style:{fontSize:10,fontWeight:700,color:"#9B72CF",letterSpacing:".1em",textTransform:"uppercase",marginBottom:10}}, cat),
        React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}},
          catItems.map(function(item) {
            return React.createElement(Panel, {key:item.id,style:{padding:0,overflow:"hidden"}},
              item.image_url ? React.createElement("img", {src:item.image_url,alt:item.name,style:{width:"100%",height:140,objectFit:"cover"}}) : null,
              React.createElement("div", {style:{padding:"12px 14px"}},
                React.createElement("div", {style:{fontSize:14,fontWeight:700,color:"#F2EDE4",marginBottom:4}}, item.name),
                React.createElement("div", {style:{fontSize:12,color:"#BECBD9",marginBottom:8,lineHeight:1.4}}, item.description || ""),
                React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
                  item.price ? React.createElement("span", {style:{fontSize:13,fontWeight:700,color:"#E8A838"}}, item.price) : null,
                  item.external_url ? React.createElement("a", {href:item.external_url,target:"_blank",rel:"noopener noreferrer",style:{fontSize:12,color:"#9B72CF",textDecoration:"none",fontWeight:600}}, "View") : null
                )
              )
            );
          })
        )
      );
    })
  );
}
```

- [ ] **Step 2: Build check + brace balance**

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: gear screen with DB-backed product grid"
```

---

### Task 26: Privacy and Terms Screens

**Files:**
- Modify: `src/App.jsx` - `PrivacyScreen()` and `TermsScreen()`

**Context:** Spec Section 21. Clean legal text with heading hierarchy, anchor links, table of contents.

- [ ] **Step 1: Create structured content arrays and render for both screens**

For each screen, define sections as a data array and render with a TOC at top:

```javascript
function PrivacyScreen() {
  var sections = [
    {id:"collect",title:"Information We Collect",body:"We collect information you provide directly: account credentials, Riot ID, region, and optional profile details (bio, social links). We also collect usage data including participation records, placement results, and platform interactions."},
    {id:"use",title:"How We Use Your Information",body:"Your information powers your competitive profile, leaderboard standings, achievement tracking, and season statistics. We use aggregate data to improve the platform. We never sell personal data."},
    {id:"share",title:"Information Sharing",body:"Your competitive results and profile are visible to other users. We do not share personal data with third parties except as required by law or to protect against fraud."},
    {id:"security",title:"Data Security",body:"We use Supabase with row-level security policies. All data is encrypted in transit and at rest. Authentication is handled through industry-standard protocols."},
    {id:"rights",title:"Your Rights",body:"You can update or delete your account at any time via Account Settings. Upon deletion, your personal data is removed. Anonymized competitive records may be retained for historical standings integrity."},
    {id:"contact",title:"Contact",body:"Questions about privacy? Reach us via Discord or email at privacy@tftclash.gg."}
  ];
  return React.createElement("div", {className:"page wrap fade-up"},
    React.createElement("h2", {className:"display",style:{fontSize:22,color:"#F2EDE4",marginBottom:4}}, "Privacy Policy"),
    React.createElement("div", {style:{fontSize:11,color:"#9AAABF",marginBottom:20}}, "Last updated: March 2026"),
    // Table of contents
    React.createElement("div", {style:{marginBottom:24,padding:"12px 16px",background:"rgba(255,255,255,.03)",borderRadius:10}},
      sections.map(function(s) {
        return React.createElement("a", {key:s.id,href:"#" + s.id,style:{display:"block",fontSize:12,color:"#9B72CF",textDecoration:"none",padding:"4px 0"}}, s.title);
      })
    ),
    // Sections
    sections.map(function(s) {
      return React.createElement("div", {key:s.id,id:s.id,style:{marginBottom:20}},
        React.createElement("h3", {style:{fontSize:15,fontWeight:700,color:"#F2EDE4",marginBottom:8}}, s.title),
        React.createElement("p", {style:{fontSize:13,color:"#BECBD9",lineHeight:1.6}}, s.body)
      );
    })
  );
}
```

Use the same pattern for TermsScreen with appropriate legal sections.

- [ ] **Step 2: Build check + brace balance**

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: privacy and terms screens with TOC and anchor links"
```

---

### Task 27: More Menu (Desktop Dropdown + Mobile Slide-Over)

**Files:**
- Modify: `src/App.jsx` - Navbar and root state

**Context:** Spec Section 22. Items with contextual visibility: Scrims (admin), Pricing (all), Rules (all), FAQ (all), Host (logged in), Gear (all), Admin (admin only).

- [ ] **Step 1: Add More menu state and render**

In the Navbar function, add a "More" button and dropdown:

```javascript
var _showMore = useState(false);
var showMore = _showMore[0];
var setShowMore = _showMore[1];

var moreItems = [
  {id:"scrims",label:"Scrims",icon:"swords",desc:"Practice lobbies",show:isAdmin||isInvited},
  {id:"pricing",label:"Pricing",icon:"diamond",desc:"Plans and features",show:true},
  {id:"rules",label:"Rules",icon:"book",desc:"Tournament rules",show:true},
  {id:"faq",label:"FAQ",icon:"help",desc:"Common questions",show:true},
  {id:"host-apply",label:"Host",icon:"crown",desc:"Apply or manage",show:!!currentUser},
  {id:"gear",label:"Gear",icon:"shopping-bag",desc:"Merch and gear",show:true},
  {id:"admin",label:"Admin",icon:"shield",desc:"Control panel",show:isAdmin}
].filter(function(item){return item.show;});
```

Desktop: dropdown panel positioned below the "More" nav button:

```javascript
showMore ? React.createElement("div", {style:{position:"absolute",top:"100%",right:0,background:"#111827",border:"1px solid rgba(155,114,207,.2)",borderRadius:12,padding:"8px",minWidth:220,zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,.5)"}},
  moreItems.map(function(item) {
    return React.createElement("div", {key:item.id,style:{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,cursor:"pointer"},
      onClick:function(){setScreen(item.id);setShowMore(false);}},
      React.createElement("i", {className:"ti ti-" + item.icon, style:{fontSize:16,color:"#9B72CF"}}),
      React.createElement("div", null,
        React.createElement("div", {style:{fontSize:13,fontWeight:600,color:"#F2EDE4"}}, item.label),
        React.createElement("div", {style:{fontSize:10,color:"#9AAABF"}}, item.desc)
      )
    );
  })
) : null
```

Mobile: Use the same items but render as a full-screen slide-over from the hamburger menu.

- [ ] **Step 2: Build check + brace balance**

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: More menu with contextual item visibility"
```

---

### Task 28: Season Recap Screen Enhancements

**Files:**
- Modify: `src/App.jsx` - `SeasonRecapScreen()` (line 14245)

**Context:** Spec Section 7.2. The recap screen should show a cinematic season summary: final placement, total points, best moment, rival matchup record, and shareable card.

- [ ] **Step 1: Enhance SeasonRecapScreen with structured sections**

Replace static content with computed season data:

```javascript
// Pre-compute recap data
var recapPlayer = props.player || linkedPlayer;
var recapStats = recapPlayer ? getStats(recapPlayer) : null;
var seasonRank = recapPlayer ? sortedPts.indexOf(recapPlayer) + 1 : 0;
var bestFinish = 8;
var bestClashName = "";
if (recapPlayer && recapPlayer.clashHistory) {
  recapPlayer.clashHistory.forEach(function(c) {
    if (c.placement < bestFinish) {
      bestFinish = c.placement;
      bestClashName = c.clashName || "Clash";
    }
  });
}
```

Render sections: Champion/Final Standing card, Stats Summary, Best Moment, Placement Distribution (reuse component), Season Trajectory sparkline, Share button.

- [ ] **Step 2: Build check + brace balance**

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: season recap with structured sections and shareable card"
```

---

### Task 29: Broadcast Mode Real-Time Updates

**Files:**
- Modify: `src/App.jsx` - `BroadcastOverlay()` component (from Task 15)

**Context:** Spec Section 15 requires real-time subscription for live updates. Task 15 built the static overlay; this task adds Supabase real-time subscription + auto-refresh.

- [ ] **Step 1: Add real-time subscription to BroadcastOverlay**

```javascript
// Inside BroadcastOverlay, subscribe to real-time updates
var _liveData = useState(players);
var liveData = _liveData[0];
var setLiveData = _liveData[1];

useEffect(function() {
  // Refresh every 10 seconds
  var interval = setInterval(function() {
    supabase.from("players").select("*").order("pts", {ascending: false}).then(function(res) {
      if (res.data) setLiveData(res.data);
    });
  }, 10000);

  // Also subscribe to real-time changes on game_results
  var channel = supabase.channel("broadcast-live")
    .on("postgres_changes", {event: "INSERT", schema: "public", table: "game_results"}, function(payload) {
      // Trigger immediate refresh on new result
      supabase.from("players").select("*").order("pts", {ascending: false}).then(function(res) {
        if (res.data) setLiveData(res.data);
      });
    })
    .subscribe();

  return function() {
    clearInterval(interval);
    supabase.removeChannel(channel);
  };
}, []);
```

Replace `players` usage in the render with `liveData`.

- [ ] **Step 2: Add "last updated" timestamp to overlay**

```javascript
var _lastUpdate = useState(new Date());
// Update on each refresh
React.createElement("div", {style:{fontSize:8,color:"rgba(255,255,255,.3)",marginTop:4}},
  "Updated: " + lastUpdate.toLocaleTimeString()
)
```

- [ ] **Step 3: Build check + brace balance**

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: broadcast overlay real-time updates via Supabase subscription"
```

---

### Task 30: Email Digest Edge Function

**Files:**
- Create: `supabase/functions/email-digest/index.ts`

**Context:** Spec Section 19. Weekly email digest sent Thursday evening via Supabase Edge Function. Template includes: next clash info, current rank, position changes, nearly-unlocked achievements, one-click register.

- [ ] **Step 1: Create the Edge Function**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get users who opted in and were active in last 30 days
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, username, email_notifications, riot_id")
    .eq("email_notifications", true);

  if (!profiles || profiles.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }));
  }

  // Get current standings
  const { data: players } = await supabase
    .from("players")
    .select("id, name, pts, auth_user_id, last_clash_rank")
    .order("pts", { ascending: false });

  // Build per-user digest content
  let sent = 0;
  for (const profile of profiles) {
    const player = players?.find(p => p.auth_user_id === profile.user_id);
    if (!player) continue;

    const rank = (players?.indexOf(player) ?? 0) + 1;
    const rankChange = player.last_clash_rank ? player.last_clash_rank - rank : 0;

    // Email content (plain text for now, HTML template later)
    const subject = "TFT Clash - Your Weekly Update";
    const body = [
      "Hey " + (profile.username || player.name) + ",",
      "",
      "Your current rank: #" + rank + (rankChange > 0 ? " (up " + rankChange + ")" : rankChange < 0 ? " (down " + Math.abs(rankChange) + ")" : ""),
      "Points: " + player.pts,
      "",
      "See you Saturday!",
      "- TFT Clash"
    ].join("\n");

    // TODO: Integrate with email provider (Resend, Postmark, etc.)
    // For now, log the digest
    console.log("[digest] Would send to:", profile.user_id, subject);
    sent++;
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Test locally**

Run: `npx supabase functions serve email-digest`
Test: `curl -X POST http://localhost:54321/functions/v1/email-digest`
Expected: JSON response with count of users processed.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/email-digest/index.ts
git commit -m "feat: weekly email digest Edge Function skeleton"
```

---

## Summary

| Phase | Tasks | What Ships |
|-------|-------|-----------|
| **Phase 1** | Tasks 1-8 | DB tables + user_profiles extensions, tier system, home dashboard (3 zones), standings with tier lines/sparklines, profile with stats grid and placement distribution |
| **Phase 2** | Tasks 9-13 | Comparison modal, pricing page, achievements, onboarding flow (with SignUp simplification), activity feed |
| **Phase 3** | Tasks 14-17 | DB-backed scrims (full CRUD), broadcast/OBS mode, Twitter sharing, events tab reorder |
| **Phase 4** | Tasks 18-22 | Admin panel wired to DB, rules/FAQ restructure, em-dash removal, animation polish |
| **Phase 5** | Tasks 23-30 | Clash screen enhancements, host dashboard, gear screen, privacy/terms, More menu, season recap, broadcast real-time, email digest |

Total: **30 tasks**, each independently committable and testable. Every UI element has corresponding database functionality. No placeholder buttons.
