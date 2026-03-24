# Clash Engine Sprint 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the TFT Clash platform production-ready for hosting the weekly Saturday night clash — Riot ID linking, tournament server selection, player result submission, and admin confirmation flow wired to the database.

**Architecture:** Eight independent phases build on each other: DB migrations lay the foundation, then Account/Admin UI adds the inputs, then Dashboard and ClashScreen consume those values. The `pending_results` table is the handoff point between player submissions and admin confirmation — the existing `game_results` write path (already working in `ClashScreen.jsx`) is upgraded with an atomic Postgres RPC to prevent race conditions.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, Supabase JS v2, React Router 6. Code style: `var` declarations, `function(){}` callbacks, no arrow functions, no backticks in JS functions (see CLAUDE.md).

---

## File Map

| File | Change Type | What Changes |
|---|---|---|
| `supabase/migrations/040_clash_engine_sprint1.sql` | Create | All DB schema changes + RPC function |
| `src/lib/constants.js` | Modify | Add `riot_id_eu` to SEED rows |
| `src/context/AppContext.jsx` | Modify | `isAdmin` from `currentUser.is_admin`, `pendingResults` state + realtime |
| `src/screens/AccountScreen.jsx` | Modify | Riot ID section (2 inputs, save, validation) |
| `src/screens/AdminScreen.jsx` | Modify | Server selector on tournament form |
| `src/screens/DashboardScreen.jsx` | Modify | Registration Riot ID confirmation, live phase inline picker |
| `src/screens/ClashScreen.jsx` | Modify | Lobby Riot ID display, admin submission review panel, atomic RPC |

---

## Task 1: DB Migrations + SEED + AppContext `isAdmin`

**Files:**
- Create: `supabase/migrations/040_clash_engine_sprint1.sql`
- Modify: `src/lib/constants.js` (SEED rows, lines ~123–150)
- Modify: `src/context/AppContext.jsx` (isAdmin derivation, lines ~48–50)

### Context
Migrations run via Supabase dashboard (SQL editor) or Supabase CLI. The migration file lives in `supabase/migrations/` for source control. The existing `isAdmin` state (AppContext line 48) reads from `localStorage("tft-admin")` — after this migration adds an `is_admin` column to `players`, AppContext must derive it from `currentUser.is_admin` instead.

### Steps

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/040_clash_engine_sprint1.sql

-- 1. Add Riot ID columns to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS riot_id_na text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS riot_id_eu text;

-- 2. Add is_admin column to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
UPDATE players SET is_admin = true WHERE id = 1;

-- 3. Add server column to tournament_state
ALTER TABLE tournament_state ADD COLUMN IF NOT EXISTS server text DEFAULT 'EU';

-- 4. Create pending_results table
CREATE TABLE IF NOT EXISTS pending_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES tournaments(id),
  round integer NOT NULL,
  lobby_number integer NOT NULL,
  player_id integer REFERENCES players(id),
  placement integer NOT NULL CHECK (placement BETWEEN 1 AND 8),
  submitted_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'disputed')),
  UNIQUE (tournament_id, round, player_id)
);

CREATE INDEX IF NOT EXISTS pending_results_lookup
  ON pending_results (tournament_id, round, lobby_number);

ALTER TABLE pending_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "players insert own pending_results"
  ON pending_results FOR INSERT
  WITH CHECK (player_id = (SELECT id FROM players WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "players read own pending_results"
  ON pending_results FOR SELECT
  USING (player_id = (SELECT id FROM players WHERE auth_user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "admin full access pending_results"
  ON pending_results
  USING (EXISTS (
    SELECT 1 FROM players
    WHERE auth_user_id = auth.uid() AND is_admin = true
  ));

-- 5. Atomic player stats increment RPC
CREATE OR REPLACE FUNCTION increment_player_stats(
  p_player_id integer,
  p_pts integer,
  p_wins integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE players
  SET
    season_pts = COALESCE(season_pts, 0) + p_pts,
    wins = COALESCE(wins, 0) + p_wins
  WHERE id = p_player_id;
END;
$$;
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Open Supabase dashboard → SQL Editor → paste and run the migration. Verify no errors.

- [ ] **Step 3: Update SEED rows in `src/lib/constants.js`**

Find the SEED array (~line 123). Add `riot_id_eu` to each homie row:

```js
// Change from:
{id:1,name:"Levitate",rank:"Challenger",region:"EUW",pts:1024,wins:16,top4:38,games:56}

// Change to (add riot_id_eu field):
{id:1,name:"Levitate",rank:"Challenger",region:"EUW",pts:1024,wins:16,top4:38,games:56,riot_id_eu:"Levitate#EUW"}
{id:2,name:"Zounderkite",rank:"Grandmaster",region:"EUW",pts:896,wins:13,top4:33,games:52,riot_id_eu:"Zounderkite#EUW"}
{id:3,name:"Uri",rank:"Master",region:"EUW",pts:780,wins:11,top4:28,games:48,riot_id_eu:"Uri#EUW"}
{id:4,name:"BingBing",rank:"Master",region:"EUW",pts:720,wins:10,top4:26,games:46,riot_id_eu:"BingBing#EUW"}
{id:5,name:"Wiwi",rank:"Diamond",region:"EUW",pts:610,wins:8,top4:22,games:44,riot_id_eu:"Wiwi#EUW"}
{id:6,name:"Ole",rank:"Diamond",region:"EUW",pts:540,wins:7,top4:20,games:40,riot_id_eu:"Ole#EUW"}
{id:7,name:"Sybor",rank:"Platinum",region:"EUW",pts:430,wins:5,top4:16,games:36,riot_id_eu:"Sybor#EUW"}
{id:8,name:"Ivdim",rank:"Platinum",region:"EUW",pts:380,wins:4,top4:14,games:32,riot_id_eu:"Ivdim#EUW"}
{id:9,name:"Vlad",rank:"Gold",region:"EUW",pts:290,wins:3,top4:10,games:28,riot_id_eu:"Vlad#EUW"}
// randoms (ids 10-24): no riot_id_eu needed
```

- [ ] **Step 4: Update `isAdmin` derivation in `src/context/AppContext.jsx`**

Find lines ~48–50 where `isAdmin` is initialized from `localStorage`:

```js
// BEFORE (around line 48):
var _isAdmin = useState(function(){
  try{return localStorage.getItem("tft-admin")==="1";}catch(e){return false;}
});
var isAdmin = _isAdmin[0];
var setIsAdmin = _isAdmin[1];
```

Keep this as the initial value (so admin works immediately on page load), but add a `useEffect` that syncs from `currentUser.is_admin` when it loads. Find where `currentUser` is set (after `fetchAndSetCurrentUser` resolves) and add:

```js
// Add this useEffect after the existing isAdmin useState, before the auth useEffect:
useEffect(function() {
  if (currentUser && currentUser.is_admin) {
    setIsAdmin(true);
  } else if (currentUser && currentUser.is_admin === false) {
    setIsAdmin(false);
  }
}, [currentUser]);
```

This keeps localStorage as fallback for the initial render and syncs the DB value once the player row loads.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/040_clash_engine_sprint1.sql src/lib/constants.js src/context/AppContext.jsx
git commit -m "feat: DB migrations for riot IDs, pending_results, is_admin + AppContext isAdmin sync"
```

---

## Task 2: AccountScreen — Riot ID Section

**Files:**
- Modify: `src/screens/AccountScreen.jsx`

### Context
`AccountScreen.jsx` is ~1204 lines. The `save()` function (around line 168) updates both `supabase.auth.updateUser()` and `supabase.from('players').update()`. Follow the same pattern for Riot IDs — update the `players` table directly (not auth metadata, since these are player-specific, not auth-level data). The `setCurrentUser` call (line ~210) already uses `Object.assign({}, user, meta, {...})` — extend it to include the new fields.

### Steps

- [ ] **Step 1: Add Riot ID state variables near the top of the component**

Find the block of `useState` declarations at the top of `AccountScreen` (around line 100–130 where other fields like `bio`, `twitch` etc. are declared). Add:

```js
var _riotIdEu = useState(currentUser ? (currentUser.riot_id_eu || '') : '');
var riotIdEu = _riotIdEu[0]; var setRiotIdEu = _riotIdEu[1];
var _riotIdNa = useState(currentUser ? (currentUser.riot_id_na || '') : '');
var riotIdNa = _riotIdNa[0]; var setRiotIdNa = _riotIdNa[1];
var _riotIdError = useState('');
var riotIdError = _riotIdError[0]; var setRiotIdError = _riotIdError[1];
```

- [ ] **Step 2: Add Riot ID save logic inside the existing `save()` function**

Inside `save()`, just before the `supabase.from('players').update(playerUpdate)` call, add the riot ID fields to `playerUpdate`:

```js
// Add to playerUpdate object:
var playerUpdate = {
  bio: meta.bio || '',
  region: riotRegion,
  social_links: socialLinks,
  riot_id_eu: riotIdEu.trim() || null,
  riot_id_na: riotIdNa.trim() || null
};
```

And extend the `setCurrentUser` call to include the new fields:

```js
var updated = Object.assign({}, user, meta, {
  // ... existing fields ...
  riot_id_eu: riotIdEu.trim() || null,
  riot_id_na: riotIdNa.trim() || null
});
setCurrentUser(updated);
```

- [ ] **Step 3: Add validation helper function (at module scope, before the component function)**

```js
function validateRiotId(val) {
  if (!val || !val.trim()) return '';
  var parts = val.trim().split('#');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return 'Use the format Username#Tag';
  }
  return '';
}
```

Call this in the save function before proceeding:

```js
// At the start of save(), before any async calls:
var euErr = validateRiotId(riotIdEu);
var naErr = validateRiotId(riotIdNa);
if (euErr || naErr) {
  setRiotIdError(euErr || naErr);
  return;
}
setRiotIdError('');
```

- [ ] **Step 4: Add the Riot ID section to the JSX**

Find where the profile edit panels are rendered (the section with `bio`, `twitch`, etc. inputs). Add a new `<Panel>` section after the existing social links section:

```jsx
<Panel className="mt-4">
  <div className="flex items-center gap-2 p-4 border-b border-outline-variant/10">
    <Icon name="sports_esports" size={18} className="text-primary" />
    <span className="font-label text-sm font-bold">Riot Accounts</span>
  </div>
  <div className="p-4 flex flex-col gap-4">

    {/* EU Riot ID */}
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
        EU Riot ID
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-tertiary/10 text-tertiary border border-tertiary/20">EU</span>
      </div>
      <Inp
        value={riotIdEu}
        onChange={function(e) { setRiotIdEu(e.target.value); setRiotIdError(''); }}
        placeholder="Username#EUW"
      />
      {riotIdEu
        ? <div className="flex items-center gap-1 text-[11px] text-tertiary"><Icon name="check_circle" size={14} />Linked — used for EU clash weeks</div>
        : <div className="flex items-center gap-1 text-[11px] text-primary"><Icon name="warning" size={14} />Not linked — you cannot register for EU weeks</div>
      }
    </div>

    {/* NA Riot ID */}
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
        NA Riot ID
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">NA</span>
      </div>
      <Inp
        value={riotIdNa}
        onChange={function(e) { setRiotIdNa(e.target.value); setRiotIdError(''); }}
        placeholder="Username#NA1"
      />
      {riotIdNa
        ? <div className="flex items-center gap-1 text-[11px] text-tertiary"><Icon name="check_circle" size={14} />Linked — used for NA clash weeks</div>
        : <div className="flex items-center gap-1 text-[11px] text-primary"><Icon name="warning" size={14} />Not linked — you cannot register for NA weeks</div>
      }
    </div>

    {riotIdError && <div className="text-[11px] text-error">{riotIdError}</div>}

  </div>
</Panel>
```

Note: `<Inp>` is the shared input component from `components/ui`. `<Icon>` is Material Symbols. `<Panel>` is the glass panel wrapper.

- [ ] **Step 5: Verify the save button already triggers `save()` — no change needed**

The existing save button calls `save()`. The Riot ID fields will be included automatically. No new button needed.

- [ ] **Step 6: Commit**

```bash
git add src/screens/AccountScreen.jsx
git commit -m "feat: add Riot ID linking (EU + NA) to AccountScreen"
```

---

## Task 3: AdminScreen — Tournament Server Field

**Files:**
- Modify: `src/screens/AdminScreen.jsx`

### Context
The AdminScreen dashboard tab (around line 537) shows the Clash Engine section with the "Run Clash" button. The tournament state is managed via `tournamentState` from `useApp()`. Server needs to be persisted to the `tournament_state` table via a Supabase update. The AdminScreen already calls `supabase.from('tournament_state').update(...)` in various places — follow the same pattern.

The `Sel` component (select wrapper) is not in the shared UI library. Define it locally at the top of the AdminScreen function body area — actually, per CLAUDE.md, NO named function components inside another component's body. Define `Sel` at module scope in `AdminScreen.jsx`.

### Steps

- [ ] **Step 1: Add `Sel` component at module scope in `AdminScreen.jsx`**

Near the top of the file, after the imports, add:

```js
function Sel(props) {
  return React.createElement('select',
    Object.assign({}, props, {
      className: 'bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/40 ' + (props.className || '')
    })
  );
}
```

- [ ] **Step 2: Add server state variable inside AdminScreen component**

Near the top of the AdminScreen component where other local state is declared, add:

```js
var _serverVal = useState(tournamentState.server || 'EU');
var serverVal = _serverVal[0];
var setServerVal = _serverVal[1];
```

Also add a `useEffect` to sync when `tournamentState.server` changes:

```js
useEffect(function() {
  if (tournamentState.server) setServerVal(tournamentState.server);
}, [tournamentState.server]);
```

- [ ] **Step 3: Add server selector to the dashboard tab tournament form**

In the dashboard tab (around line 537), find the tournament creation/scheduling area. Add the server selector next to the clash timestamp input. Look for where `clashTimestamp` is set and add the server field nearby:

```jsx
<div className="flex flex-col gap-1 mt-3">
  <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Server</div>
  <Sel
    value={serverVal}
    onChange={function(e) { setServerVal(e.target.value); }}
  >
    <option value="EU">EU — EUW / EUNE</option>
    <option value="NA">NA — NA1</option>
  </Sel>
</div>
```

- [ ] **Step 4: Persist server when saving tournament state**

Find where the admin saves/updates the tournament state (look for `supabase.from('tournament_state').update` calls or `setTournamentState` calls triggered by an admin save button). When the admin saves the tournament setup, include `server: serverVal` in the update:

```js
// In the save/schedule function, add server to the tournamentState update:
setTournamentState(function(ts) {
  return Object.assign({}, ts, { server: serverVal });
});

// And in the Supabase write:
supabase.from('tournament_state').update({ server: serverVal })
  .eq('id', 1)
  .then(function(r) {
    if (r.error) console.error('[TFT] Failed to save server:', r.error);
  });
```

- [ ] **Step 5: Display current server in the tournament info section**

In the Clash Engine header (around line 537), add the server badge next to the tournament status:

```jsx
<div className="flex items-center gap-2 mt-1">
  <span className="text-xs text-on-surface-variant">Server:</span>
  <span className={'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ' +
    (tournamentState.server === 'NA'
      ? 'bg-primary/10 text-primary border border-primary/20'
      : 'bg-tertiary/10 text-tertiary border border-tertiary/20')
  }>{tournamentState.server || 'EU'}</span>
</div>
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/AdminScreen.jsx
git commit -m "feat: add server (NA/EU) selector to AdminScreen tournament form"
```

---

## Task 4: DashboardScreen — Registration Riot ID Confirmation

**Files:**
- Modify: `src/screens/DashboardScreen.jsx`

### Context
The ClashCard registration phase bottom zone is around lines 652–674. It currently shows a countdown, registered count, "Register Now" button, and "Who's In" button. We need to add the server display and Riot ID confirmation/warning box above the buttons. Read `tournamentState.server` and `currentUser.riot_id_eu` / `currentUser.riot_id_na` from context.

### Steps

- [ ] **Step 1: Add Riot ID derivation variables to the ClashCard component (~line 518)**

Find the `ClashCard` component function. In the variables section at the top of the component (where `phase`, `tRound`, `isRegistered` etc. are derived), add:

```js
var server = tournamentState.server || 'EU';
var riotField = server === 'NA' ? 'riot_id_na' : 'riot_id_eu';
var linkedRiotId = currentUser ? (currentUser[riotField] || '') : '';
var canRegister = isRegistered || !!linkedRiotId;
```

- [ ] **Step 2: Update the registration phase bottom zone (~lines 652–674)**

Replace the registration phase JSX block. The current block starts with `{(phase === 'registration') && (` and ends before the checkin phase. Replace its contents:

```jsx
{(phase === 'registration') && (
  <div>
    {hasCountdown && (
      <div className="mb-1">
        <ClashCountdown target={clashTimestamp} />
      </div>
    )}
    <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-3">
      {'Until check-in closes \u00b7 ' + registeredCount + '/' + maxPlayers + ' registered \u00b7 ' + (server) + ' week'}
    </div>
    {linkedRiotId ? (
      <div className="flex items-center gap-2 bg-tertiary/[0.05] border border-tertiary/15 rounded-lg p-2.5 mb-3">
        <Icon name="sports_esports" size={16} className="text-tertiary flex-shrink-0" />
        <div>
          <div className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant">{'Your ' + server + ' account'}</div>
          <div className="font-mono text-sm font-semibold">{linkedRiotId}</div>
        </div>
      </div>
    ) : (
      <div className="flex items-center gap-2 bg-primary/[0.06] border border-primary/20 rounded-lg p-2.5 mb-3">
        <Icon name="warning" size={16} className="text-primary flex-shrink-0" />
        <div className="text-[12px] text-primary">{'Link your ' + server + ' Riot ID in Account settings before registering.'}</div>
      </div>
    )}
    <div className="flex gap-2">
      <Btn
        variant={isRegistered ? 'ghost' : 'primary'}
        size="sm"
        className="flex-[2]"
        disabled={!canRegister}
        onClick={function() { navigate('/clash'); }}
      >
        {isRegistered ? 'Already Registered' : 'Register Now'}
      </Btn>
      {!linkedRiotId && !isRegistered
        ? <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/account'); }}>Go to Account</Btn>
        : <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/clash'); }}>{"Who's In"}</Btn>
      }
    </div>
  </div>
)}
```

Note: `\u00b7` is the `·` middle dot character (no backtick strings allowed). String concatenation used throughout.

- [ ] **Step 3: Verify the registration flow still works end-to-end**

Run the app (`npm run dev`), navigate to Dashboard. If `tournamentState.phase` is `'registration'`, the card should show the new Riot ID confirmation box. If `currentUser.riot_id_eu` is set, it shows the teal confirmation. If not, it shows the gold warning and disables Register Now.

- [ ] **Step 4: Commit**

```bash
git add src/screens/DashboardScreen.jsx
git commit -m "feat: show server + Riot ID confirmation in registration ClashCard phase"
```

---

## Task 5: ClashScreen — Lobby Riot ID Display

**Files:**
- Modify: `src/screens/ClashScreen.jsx`

### Context
In ClashScreen, the lobby cards render each player in a lobby. Find the `LobbyCard` component or the lobby rendering section (~lines 1380–1430). Each player row currently shows their name and rank. Add their Riot ID for the current server next to their name. `tournamentState.server` is available via `useApp()`. Each player object in the `players` array now has `riot_id_eu` and `riot_id_na` fields after the migration.

### Steps

- [ ] **Step 1: Find the lobby player row rendering**

Search for where player names are rendered inside lobbies. Look for `p.name` or `lp.name` inside a lobby map. It will look something like:

```js
lobby.map(function(p) {
  return <div key={p.id}>{p.name}</div>
})
```

- [ ] **Step 2: Add Riot ID display to each player row**

Update the player row to show the Riot ID. Add `server` derivation near the top of the ClashScreen component or wherever `tournamentState` is destructured:

```js
var server = tournamentState.server || 'EU';
var riotIdField = server === 'NA' ? 'riot_id_na' : 'riot_id_eu';
```

Then in the player row render, add the Riot ID alongside the name:

```jsx
<div key={p.id} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
  <span className="text-sm font-semibold font-display">{p.name || p.username}</span>
  {p[riotIdField]
    ? <span className="font-mono text-[11px] text-on-surface-variant">{p[riotIdField]}</span>
    : <span className="flex items-center gap-1 text-[11px] text-primary/60"><Icon name="warning" size={12} />No ID</span>
  }
</div>
```

- [ ] **Step 3: Verify lobby display**

Start a clash in dev, assign lobbies, open ClashScreen. Each player in the lobby card should show their Riot ID (or warning) in a monospace font on the right side of their row.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ClashScreen.jsx
git commit -m "feat: show player Riot IDs in ClashScreen lobby cards"
```

---

## Task 6: Result Persistence Audit + Atomic RPC

**Files:**
- Modify: `src/screens/ClashScreen.jsx` (lines ~1540–1580)

### Context
The `applyLobbyResults()` function (around line 1540) already writes to `game_results` and updates `players` stats. The audit shows it WORKS but uses a client-side read-modify-write pattern for `season_pts` and `wins`. This must be replaced with the `increment_player_stats` RPC created in Task 1 to prevent race conditions when multiple lobbies finalize at the same time. Note: the column is `season_pts` in the DB (not `pts`).

### Steps

- [ ] **Step 1: Read the existing `applyLobbyResults` function (~lines 1540–1577)**

Understand the current flow:
1. Iterates lobby players, builds `gameRows` array
2. Inserts to `game_results`
3. In the `.then()` success handler, reads each player's current `pts`/`wins` from local state, adds the new values, and calls `supabase.from('players').update({season_pts, wins, ...})`

- [ ] **Step 2: Replace step 3 with the atomic RPC call**

Inside the `supabase.from('game_results').insert(gameRows).then(function(res) { ... })` success handler, replace the player stat update block:

```js
// REMOVE: the forEach that reads currentPlayer.pts and does update({season_pts: newPts, wins: newWins...})

// REPLACE WITH:
gameRows.forEach(function(row) {
  var ptsGained = row.points || 0;
  var winsGained = row.placement === 1 ? 1 : 0;
  if (ptsGained === 0 && winsGained === 0) return;
  supabase.rpc('increment_player_stats', {
    p_player_id: row.player_id,
    p_pts: ptsGained,
    p_wins: winsGained
  }).then(function(rpcRes) {
    if (rpcRes.error) {
      console.error('[TFT] increment_player_stats failed for player', row.player_id, rpcRes.error);
    }
  });
});
```

Also keep the local state update (for immediate UI refresh without re-fetch):

```js
// After the RPC calls, update local players state:
setPlayers(function(ps) {
  return ps.map(function(p) {
    var row = gameRows.find(function(r) { return r.player_id === p.id; });
    if (!row) return p;
    return Object.assign({}, p, {
      pts: (p.pts || 0) + (row.points || 0),
      wins: (p.wins || 0) + (row.placement === 1 ? 1 : 0)
    });
  });
});
```

- [ ] **Step 3: Verify game_results write works**

In dev, run through a full lobby result entry. Check Supabase dashboard → `game_results` table — rows should appear. Check `players` table — `season_pts` and `wins` should increment.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ClashScreen.jsx
git commit -m "fix: use atomic RPC for player stat increments, keep local state sync"
```

---

## Task 7: Player Placement Submission — Dashboard

**Files:**
- Modify: `src/context/AppContext.jsx` (add `pendingResults` state)
- Modify: `src/screens/DashboardScreen.jsx` (inline picker in live phase)

### Context
The live phase ClashCard bottom zone (~lines 697–717) currently shows a lobby box and two buttons. The "Submit Results" button navigates to `/clash`. Replace this: "Submit Results" triggers an inline placement picker within the card. After the player confirms their placement, the card shows their submission and waits for admin confirmation.

AppContext needs a `pendingResults` state array (the player's own pending submission for the current tournament + round) so the ClashCard knows whether to show the picker or the "already submitted" state.

### Steps

- [ ] **Step 1: Add `pendingResults` state to AppContext**

In `src/context/AppContext.jsx`, after the existing state declarations (around line 87–100), add:

```js
var _pendingResults = useState([]);
var pendingResults = _pendingResults[0];
var setPendingResults = _pendingResults[1];
```

Expose it via the context value object (find where `value=` is set in the Provider return, add `pendingResults: pendingResults`).

- [ ] **Step 2: Load player's own pending submissions in AppContext**

Add a `useEffect` that fires when `currentUser` and `tournamentState.id` are both set:

```js
useEffect(function() {
  if (!currentUser || !tournamentState.id || !supabase.from) return;
  supabase.from('pending_results')
    .select('*')
    .eq('tournament_id', tournamentState.id)
    .eq('player_id', currentUser.id)
    .then(function(res) {
      if (res.data) setPendingResults(res.data);
    });
}, [currentUser && currentUser.id, tournamentState.id]);
```

Add realtime subscription on `pending_results` filtered to the current player:

```js
// Inside the realtime subscription useEffect, add:
var prChannel = supabase
  .channel('pending-results-player')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'pending_results',
    filter: currentUser ? ('player_id=eq.' + currentUser.id) : undefined
  }, function(payload) {
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      setPendingResults(function(prev) {
        var existing = prev.filter(function(r) { return r.id !== payload.new.id; });
        return existing.concat([payload.new]);
      });
    }
  })
  .subscribe();
// Remember to unsubscribe on cleanup
```

- [ ] **Step 3: Add `showPicker` state and submission logic to ClashCard**

In `DashboardScreen.jsx`, inside the `ClashCard` component function, add:

```js
var _showPicker = useState(false);
var showPicker = _showPicker[0];
var setShowPicker = _showPicker[1];
var _selectedPlace = useState(0);
var selectedPlace = _selectedPlace[0];
var setSelectedPlace = _selectedPlace[1];
var _submitting = useState(false);
var submitting = _submitting[0];
var setSubmitting = _submitting[1];
```

Also derive whether the player has already submitted for this round:

```js
var mySubmission = pendingResults && pendingResults.find(function(r) {
  return r.round === tournamentState.round && r.status !== 'disputed';
});
```

Add the submission handler function (at module scope, NOT inside ClashCard — remember no named function components or named functions inside component bodies per CLAUDE.md — actually CLAUDE.md says no named FUNCTION COMPONENTS inside component bodies, but regular functions are fine. Let me put it inside ClashCard but as a regular function):

```js
function handleSubmitPlacement() {
  if (!selectedPlace || !currentUser || !tournamentState.id) return;
  setSubmitting(true);
  supabase.from('pending_results').upsert({
    tournament_id: tournamentState.id,
    round: tournamentState.round,
    lobby_number: lobbyNum || 1,
    player_id: currentUser.id,
    placement: selectedPlace,
    status: 'pending'
  }, { onConflict: 'tournament_id,round,player_id' })
  .then(function(res) {
    setSubmitting(false);
    if (res.error) {
      toast('Failed to submit placement. Try again.', 'error');
      return;
    }
    setShowPicker(false);
    setSelectedPlace(0);
    toast('Placement submitted!', 'success');
  });
}
```

- [ ] **Step 4: Update the live phase bottom zone (~lines 697–717)**

Replace the live phase `{(phase === 'live' || phase === 'inprogress') && ( ... )}` block:

```jsx
{(phase === 'live' || phase === 'inprogress') && (
  <div>
    <div className="text-sm text-[#9D8E7C] mb-3">{'Round ' + tRound + ' of ' + totalGames}</div>
    {mySubmission ? (
      /* Already submitted state */
      <div>
        <div className="bg-tertiary/[0.06] border border-tertiary/20 rounded-lg p-3 text-center mb-3">
          <div className="font-display text-[40px] text-primary leading-none">{ordinal(mySubmission.placement)}</div>
          <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">{'Your submission \u00b7 Lobby ' + lobbyNum}</div>
          <div className="flex items-center justify-center gap-1 text-[11px] text-tertiary mt-1.5">
            <Icon name="schedule" size={13} />Waiting for admin to confirm
          </div>
        </div>
        <div className="text-[11px] text-on-surface-variant text-center">Results lock in once admin confirms all lobbies.</div>
      </div>
    ) : showPicker ? (
      /* Placement picker state */
      <div>
        <div className="text-[12px] text-on-surface-variant mb-2">{'How did you finish in Lobby ' + lobbyNum + '?'}</div>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {[1,2,3,4,5,6,7,8].map(function(n) {
            return (
              <button
                key={n}
                onClick={function() { setSelectedPlace(n); }}
                className={'py-2.5 rounded-lg border text-center cursor-pointer transition-all ' +
                  (selectedPlace === n
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-white/[0.04] border-white/[0.08] text-on-surface/70 hover:border-tertiary/30 hover:text-tertiary'
                  )
                }
              >
                <div className="font-mono text-base font-semibold leading-none">{n}</div>
                <div className="font-label text-[8px] uppercase tracking-wide mt-0.5 opacity-70">{ordinal(n).replace(String(n), '')}</div>
              </button>
            );
          })}
        </div>
        <Btn
          variant="primary"
          size="sm"
          className="w-full mb-1"
          disabled={!selectedPlace || submitting}
          onClick={handleSubmitPlacement}
        >
          {selectedPlace ? ('Confirm ' + ordinal(selectedPlace) + ' Place') : 'Select your placement'}
        </Btn>
        <button
          onClick={function() { setShowPicker(false); setSelectedPlace(0); }}
          className="w-full text-center text-[11px] text-on-surface-variant py-1 cursor-pointer"
        >Cancel</button>
      </div>
    ) : (
      /* Default live state */
      <div>
        {myLobby ? (
          <div className="bg-tertiary/[0.06] border border-tertiary/15 rounded-lg p-3 mb-3">
            <div className="font-label text-xs font-bold text-tertiary mb-1">{'You are in Lobby ' + lobbyNum}</div>
            <div className="text-[11px] text-on-surface/50 leading-relaxed">{lobbyNames}</div>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant mb-3">You are not in a lobby this round.</p>
        )}
        <div className="flex gap-2">
          <Btn
            variant="ghost"
            size="sm"
            className="flex-[2] bg-[rgba(103,226,217,0.1)] text-[#67E2D9] border border-[rgba(103,226,217,0.2)]"
            onClick={function() { setShowPicker(true); }}
          >Submit Results</Btn>
          <Btn variant="ghost" size="sm" className="flex-1" onClick={function() { navigate('/clash'); }}>Live Board</Btn>
        </div>
      </div>
    )}
  </div>
)}
```

Note: `ordinal` is already imported from `src/lib/utils.js`. String concatenation used throughout (no backticks).

- [ ] **Step 5: Test the picker flow**

Run the app. Set `tournamentState.phase = 'live'` temporarily in AppContext default to test. The ClashCard should show the default live state → clicking "Submit Results" shows the picker → selecting a number highlights gold → confirming writes to `pending_results` and shows the submitted state.

- [ ] **Step 6: Commit**

```bash
git add src/context/AppContext.jsx src/screens/DashboardScreen.jsx
git commit -m "feat: player placement submission - inline picker on Dashboard ClashCard"
```

---

## Task 8: Admin Submission Review Panel (ClashScreen)

**Files:**
- Modify: `src/screens/ClashScreen.jsx`

### Context
The ClashScreen is the admin's tournament control panel. Each lobby card needs a results submission review section showing all 8 players' submissions from `pending_results`, conflict detection, and a "Confirm All" button that writes to `game_results` and advances the round.

AppContext already loads `pendingResults` for the logged-in player. For the admin, we need ALL submissions for a lobby. Add an admin-specific subscription that loads all `pending_results` for the current tournament (admin sees all rows via RLS policy with `is_admin = true`).

### Steps

- [ ] **Step 1: Add admin `allPendingResults` state to AppContext**

In `AppContext.jsx`, add a new state array and loading logic for admin:

```js
var _allPendingResults = useState([]);
var allPendingResults = _allPendingResults[0];
var setAllPendingResults = _allPendingResults[1];
```

In the data loading section, add a load triggered when `isAdmin && tournamentState.id`:

```js
useEffect(function() {
  if (!isAdmin || !tournamentState.id || !supabase.from) return;
  supabase.from('pending_results')
    .select('*')
    .eq('tournament_id', tournamentState.id)
    .then(function(res) {
      if (res.data) setAllPendingResults(res.data);
    });

  var adminPrChannel = supabase
    .channel('pending-results-admin')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'pending_results'
    }, function(payload) {
      if (payload.eventType === 'DELETE') {
        setAllPendingResults(function(prev) {
          return prev.filter(function(r) { return r.id !== payload.old.id; });
        });
      } else {
        setAllPendingResults(function(prev) {
          var without = prev.filter(function(r) { return r.id !== payload.new.id; });
          return without.concat([payload.new]);
        });
      }
    })
    .subscribe();

  return function() { supabase.removeChannel(adminPrChannel); };
}, [isAdmin, tournamentState.id]);
```

Expose `allPendingResults` via the context value.

- [ ] **Step 2: Add submission review panel component at module scope in ClashScreen.jsx**

Add a new component `LobbySubmissionPanel` at module scope (NOT inside another component):

```js
function LobbySubmissionPanel(props) {
  var lobby = props.lobby;
  var round = props.round;
  var lobbyNum = props.lobbyNum;
  var tournamentId = props.tournamentId;
  var allPendingResults = props.allPendingResults;
  var players = props.players;
  var onConfirmAll = props.onConfirmAll;
  var _disputePlayer = useState(null);
  var disputePlayer = _disputePlayer[0];
  var setDisputePlayer = _disputePlayer[1];
  var _disputeVal = useState('');
  var disputeVal = _disputeVal[0];
  var setDisputeVal = _disputeVal[1];

  var submissions = allPendingResults.filter(function(r) {
    return r.round === round && r.lobby_number === lobbyNum;
  });

  // Detect conflicts: two players submitting same placement in same lobby
  var placementCounts = {};
  submissions.forEach(function(r) {
    if (!placementCounts[r.placement]) placementCounts[r.placement] = [];
    placementCounts[r.placement].push(r.player_id);
  });
  var hasConflict = Object.keys(placementCounts).some(function(p) {
    return placementCounts[p].length > 1;
  });

  var allSubmitted = lobby.length > 0 && submissions.length === lobby.length;
  var canConfirm = allSubmitted && !hasConflict;

  return React.createElement('div', { className: 'mt-3 border-t border-white/[0.05] pt-3' },
    React.createElement('div', { className: 'font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2' },
      submissions.length + ' / ' + lobby.length + ' submitted'
    ),
    lobby.map(function(p) {
      var sub = submissions.find(function(r) { return r.player_id === p.id; });
      var isConflict = sub && placementCounts[sub.placement] && placementCounts[sub.placement].length > 1;
      var isDisputing = disputePlayer === p.id;
      return React.createElement('div', {
        key: p.id,
        className: 'flex items-center gap-2 py-2 border-b border-white/[0.03] last:border-0 text-sm'
      },
        React.createElement('div', {
          className: 'w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-bold flex-shrink-0 ' +
            (sub ? (sub.placement === 1 ? 'bg-primary-dim text-bg' : 'bg-white/10 text-on-surface') : 'bg-white/[0.04] text-on-surface-variant border border-dashed border-white/20')
        }, sub ? String(sub.placement) : '?'),
        React.createElement('span', { className: 'flex-1 font-display font-semibold text-sm' }, p.name || p.username),
        isDisputing
          ? React.createElement('div', { className: 'flex items-center gap-1' },
              React.createElement('input', {
                type: 'number', min: '1', max: '8',
                value: disputeVal,
                onChange: function(e) { setDisputeVal(e.target.value); },
                className: 'w-12 bg-surface-container border border-outline-variant/20 rounded px-2 py-1 text-sm text-center font-mono'
              }),
              React.createElement(Btn, {
                variant: 'primary', size: 'sm',
                onClick: function() {
                  var val = parseInt(disputeVal);
                  if (val < 1 || val > 8) return;
                  supabase.from('pending_results').upsert({
                    tournament_id: tournamentId,
                    round: round,
                    lobby_number: lobbyNum,
                    player_id: p.id,
                    placement: val,
                    status: 'pending'
                  }, { onConflict: 'tournament_id,round,player_id' }).then(function(r) {
                    if (!r.error) { setDisputePlayer(null); setDisputeVal(''); }
                  });
                }
              }, 'Save'),
              React.createElement(Btn, { variant: 'ghost', size: 'sm', onClick: function() { setDisputePlayer(null); } }, 'Cancel')
            )
          : React.createElement('div', { className: 'flex items-center gap-2' },
              React.createElement('span', {
                className: 'text-[10px] px-2 py-0.5 rounded font-label font-bold uppercase tracking-wide ' +
                  (isConflict ? 'bg-error/10 text-error' : sub ? 'bg-tertiary/10 text-tertiary' : 'bg-white/[0.05] text-on-surface-variant')
              }, isConflict ? 'Conflict' : sub ? 'Submitted' : 'Pending'),
              React.createElement('button', {
                className: 'text-[10px] text-on-surface-variant underline cursor-pointer',
                onClick: function() { setDisputePlayer(p.id); setDisputeVal(sub ? String(sub.placement) : ''); }
              }, 'Override')
            )
      );
    }),
    React.createElement('div', { className: 'flex gap-2 mt-3' },
      React.createElement(Btn, {
        variant: 'primary',
        size: 'sm',
        className: 'flex-[2]',
        disabled: !canConfirm,
        onClick: function() { onConfirmAll(lobbyNum, submissions); }
      }, 'Confirm All'),
      React.createElement(Btn, {
        variant: 'ghost',
        size: 'sm',
        className: 'flex-1 text-error border-error/20',
      }, 'Dispute')
    )
  );
}
```

- [ ] **Step 3: Add `handleConfirmAll` function in ClashScreen (at module scope or as a named function inside the component)**

In ClashScreen, add the confirm all handler:

```js
function handleConfirmAll(lobbyNum, submissions) {
  if (!tournamentState.id || !submissions.length) return;
  var round = tournamentState.round;

  // 1. Mark submissions as confirmed
  submissions.forEach(function(sub) {
    supabase.from('pending_results')
      .update({ status: 'confirmed' })
      .eq('id', sub.id)
      .then(function(r) {
        if (r.error) console.error('[TFT] Failed to confirm submission', r.error);
      });
  });

  // 2. Insert into game_results
  var gameRows = submissions.map(function(sub) {
    return {
      tournament_id: tournamentState.id,
      round_number: round,
      player_id: sub.player_id,
      placement: sub.placement,
      points: PTS[sub.placement] || 0,
      is_dnp: false,
      game_number: round
    };
  });
  supabase.from('game_results').insert(gameRows).then(function(res) {
    if (res.error) { toast('Failed to save results: ' + res.error.message, 'error'); return; }

    // 3. Atomic increment for each player
    gameRows.forEach(function(row) {
      supabase.rpc('increment_player_stats', {
        p_player_id: row.player_id,
        p_pts: row.points,
        p_wins: row.placement === 1 ? 1 : 0
      }).then(function(r) {
        if (r.error) console.error('[TFT] RPC failed:', r.error);
      });
    });

    // 4. Update local players state
    setPlayers(function(ps) {
      return ps.map(function(p) {
        var row = gameRows.find(function(r) { return r.player_id === p.id; });
        if (!row) return p;
        return Object.assign({}, p, {
          pts: (p.pts || 0) + row.points,
          wins: (p.wins || 0) + (row.placement === 1 ? 1 : 0)
        });
      });
    });

    // 5. Check if all lobbies confirmed for this round, advance phase
    supabase.from('pending_results')
      .select('id', { count: 'exact' })
      .eq('tournament_id', tournamentState.id)
      .eq('round', round)
      .neq('status', 'confirmed')
      .then(function(checkRes) {
        if (checkRes.count === 0) {
          // All lobbies confirmed
          if (round >= (tournamentState.totalGames || 3)) {
            // Final round - complete
            var nextState = Object.assign({}, tournamentState, { phase: 'complete' });
            setTournamentState(nextState);
            supabase.from('tournament_state').update({ phase: 'complete' }).eq('id', 1);
          } else {
            // Advance round
            var nextRound = round + 1;
            var nextState = Object.assign({}, tournamentState, { round: nextRound });
            setTournamentState(nextState);
            supabase.from('tournament_state').update({ round: nextRound }).eq('id', 1);
          }
        }
        toast('Lobby ' + lobbyNum + ' results confirmed!', 'success');
      });
  });
}
```

- [ ] **Step 4: Render `LobbySubmissionPanel` inside each lobby card**

Find where lobby cards are rendered in ClashScreen (search for `lobby.map` or `lobbies.map` in the live/inprogress phase rendering, around lines 1380–1430). Inside each lobby card, after the player list, add:

```jsx
{isAdmin && (
  <LobbySubmissionPanel
    lobby={lobby}
    round={tournamentState.round}
    lobbyNum={lobbyIndex + 1}
    tournamentId={tournamentState.id}
    allPendingResults={allPendingResults}
    players={players}
    onConfirmAll={handleConfirmAll}
  />
)}
```

Where `allPendingResults` comes from `useApp()`.

- [ ] **Step 5: Full end-to-end smoke test**

Test the complete flow in dev:
1. Set tournament to `phase: 'live'`, `round: 1` with one lobby of 8 players
2. As a player: open Dashboard, click "Submit Results", select placement, confirm → see "Waiting for admin" state
3. As admin: open ClashScreen → see submission in lobby panel → Confirm All → check Supabase `game_results` table has the rows → check `players` table `season_pts` incremented
4. Verify DashboardScreen standings show updated points

- [ ] **Step 6: Commit**

```bash
git add src/context/AppContext.jsx src/screens/ClashScreen.jsx
git commit -m "feat: admin submission review panel - conflict detection, Confirm All, atomic result persistence"
```

---

## Final Verification

- [ ] Run `npm run dev` and smoke test the full Saturday night flow:
  1. Admin opens AdminScreen, sets server to EU, sets clash timestamp, opens registration
  2. Player opens AccountScreen, links EU Riot ID, saves
  3. Player opens Dashboard — registration card shows EU week + Riot ID confirmation + Register Now enabled
  4. Player registers (navigates to /clash)
  5. Admin checks in all players, starts clash, assigns lobbies
  6. ClashScreen lobby cards show each player's Riot IDs
  7. Player on Dashboard submits placement — card shows "Waiting for admin"
  8. Admin in ClashScreen sees all 8 submissions — clicks Confirm All
  9. Supabase `game_results` table has the rows, `players.season_pts` incremented
  10. Dashboard ClashCard transitions to `complete` phase showing top 3

- [ ] Push to remote branch

```bash
git push origin feat/restoration-overhaul
```
