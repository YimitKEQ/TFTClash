# BrosephTech Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PIN-protected internal command center at `/brosephtech` for the BrosephTech TFT content team — Kanban content board, metrics dashboard, and SOP library, all backed by Supabase.

**Architecture:** Single React screen with tab-based navigation, no sidebar (standalone layout), PIN gate backed by localStorage. Sub-components split into `src/screens/brosephtech/` for Kanban, Metrics, and SOPs. Supabase powers the live content board and metrics history.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, Supabase (PostgreSQL + JS client), Material Symbols via `<Icon>`, no drag-and-drop libraries (HTML5 native).

**Brand:** BT Blue `#5BA3DB`, BT Gold `#E8A020`, dark background `#0b0e1a`, surface `#13172a`. Logo at `public/btlogo.png`.

**PIN:** `1738` (hardcoded, stored in localStorage under key `bt_unlocked`).

**Team members (assignees):** `Levitate`, `Co-Founder`, `Founder 3`, `Scriptwriter`, `Editor`, `GFX`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `public/btlogo.png` | Create (copy) | BrosephTech logo served as static asset |
| `src/App.jsx:247` | Modify | Add `"/brosephtech":"brosephtech"` to URL map |
| `src/App.jsx:437` | Modify | Add `"brosephtech"` to safeScreens array |
| `src/App.jsx:95-97` | Modify | Add lazy import for BrosephTechScreen |
| `src/App.jsx:710` | Modify | Add `{screen==="brosephtech"&&<BrosephTechScreen/>}` |
| `src/screens/BrosephTechScreen.jsx` | Create | PIN gate + tab shell + BT header |
| `src/screens/brosephtech/BTBoard.jsx` | Create | Kanban board with Supabase CRUD |
| `src/screens/brosephtech/BTMetrics.jsx` | Create | Metrics snapshots dashboard |
| `src/screens/brosephtech/BTSops.jsx` | Create | Hardcoded TFT content production SOPs |

---

## Task 1: Supabase DB Migrations

**Files:**
- Supabase migration via MCP tool

- [ ] **Step 1: Run bt_content_cards migration**

Use `mcp__supabase__apply_migration` with name `bt_content_cards`:

```sql
CREATE TABLE bt_content_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  column_id TEXT NOT NULL DEFAULT 'ideas',
  sort_order INTEGER DEFAULT 0,
  content_type TEXT DEFAULT 'short',
  platform TEXT DEFAULT 'both',
  assignee TEXT DEFAULT '',
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bt_content_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bt_cards_open" ON bt_content_cards FOR ALL USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Run bt_metrics_snapshots migration**

Use `mcp__supabase__apply_migration` with name `bt_metrics_snapshots`:

```sql
CREATE TABLE bt_metrics_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  yt_subs INTEGER DEFAULT 0,
  tiktok_followers INTEGER DEFAULT 0,
  patreon_subs INTEGER DEFAULT 0,
  avg_views INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bt_metrics_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bt_metrics_open" ON bt_metrics_snapshots FOR ALL USING (true) WITH CHECK (true);
```

- [ ] **Step 3: Verify tables exist**

Use `mcp__supabase__execute_sql`:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'bt_%';
```

Expected: rows for `bt_content_cards` and `bt_metrics_snapshots`.

- [ ] **Step 4: Seed one test card**

```sql
INSERT INTO bt_content_cards (title, content_type, platform, assignee, priority, column_id)
VALUES ('Test card - delete me', 'short', 'tiktok', 'Levitate', 'low', 'ideas');
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(brosephtech): add Supabase tables bt_content_cards + bt_metrics_snapshots"
```

---

## Task 2: Static Assets + App.jsx Wiring

**Files:**
- Create: `public/btlogo.png`
- Modify: `src/App.jsx`

- [ ] **Step 1: Copy logo to public/**

```bash
cp /c/Users/gubje/Downloads/tft-clash/btskills/btlogo.png /c/Users/gubje/Downloads/tft-clash/public/btlogo.png
```

- [ ] **Step 2: Add lazy import to App.jsx**

In `src/App.jsx` after line 97 (after `var Donut17ScreenNew = lazyWithRetry...`), add:

```js
var BrosephTechScreen = lazyWithRetry(function(){ return import('./screens/BrosephTechScreen'); });
```

- [ ] **Step 3: Add URL mapping to App.jsx**

Find this line in App.jsx (around line 247):
```
"/tournaments":"tournaments","/roster":"roster","/featured":"featured","/gear":"gear","/stats":"stats","/sponsors":"sponsors","/ops":"ops","/content-engine":"content-engine","/status":"status","/donut17":"donut17"
```

Replace with (add `/brosephtech` at end):
```
"/tournaments":"tournaments","/roster":"roster","/featured":"featured","/gear":"gear","/stats":"stats","/sponsors":"sponsors","/ops":"ops","/content-engine":"content-engine","/status":"status","/donut17":"donut17","/brosephtech":"brosephtech"
```

- [ ] **Step 4: Add to safeScreens array in App.jsx**

Find (around line 437):
```js
var safeScreens=["home","standings","clash","events","bracket","leaderboard","profile","results","hof","archive","milestones","challenges","rules","faq","pricing","recap","account","host-apply","host-dashboard","scrims","admin","roster","featured","privacy","terms","gear","tournaments","signup","login","status","sponsors","ops","content-engine","stats"];
```

Replace with (add `"brosephtech"` at end of array before `]`):
```js
var safeScreens=["home","standings","clash","events","bracket","leaderboard","profile","results","hof","archive","milestones","challenges","rules","faq","pricing","recap","account","host-apply","host-dashboard","scrims","admin","roster","featured","privacy","terms","gear","tournaments","signup","login","status","sponsors","ops","content-engine","stats","brosephtech"];
```

- [ ] **Step 5: Add screen render in App.jsx**

Find (around line 709):
```jsx
{screen==="donut17"&&<Donut17ScreenNew/>}
```

Add after it:
```jsx
{screen==="brosephtech"&&<BrosephTechScreen/>}
```

- [ ] **Step 6: Verify dev server compiles (BrosephTechScreen.jsx must exist first — create a placeholder)**

Create `src/screens/BrosephTechScreen.jsx` with:
```jsx
import React from 'react';
export default function BrosephTechScreen() {
  return <div className="text-white p-8">BrosephTech - coming soon</div>;
}
```

Start dev server and visit `http://localhost:5173/brosephtech` — should render the placeholder without errors.

```bash
npm run dev
```

Expected: page loads, no console errors, text "BrosephTech - coming soon" visible.

- [ ] **Step 7: Commit**

```bash
git add public/btlogo.png src/App.jsx src/screens/BrosephTechScreen.jsx
git commit -m "feat(brosephtech): wire route + add logo asset"
```

---

## Task 3: BrosephTechScreen.jsx — PIN Gate + Tab Shell

**Files:**
- Modify: `src/screens/BrosephTechScreen.jsx`

This screen has two named top-level components: `PinGate` (the lock screen) and `BrosephTechScreen` (the main app). Neither is defined inside the other — both are top-level functions.

- [ ] **Step 1: Write PinGate component**

Replace `src/screens/BrosephTechScreen.jsx` entirely with:

```jsx
import React from 'react';
import BTBoard from './brosephtech/BTBoard';
import BTMetrics from './brosephtech/BTMetrics';
import BTSops from './brosephtech/BTSops';

var PIN = '1738';
var SESSION_KEY = 'bt_unlocked';

var TABS = [
  { id: 'board', label: 'Content Board', icon: 'view_kanban' },
  { id: 'metrics', label: 'Metrics', icon: 'trending_up' },
  { id: 'sops', label: 'SOPs', icon: 'menu_book' },
];

function Icon(props) {
  return (
    <span className={'material-symbols-outlined ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

function PinGate(props) {
  var [input, setInput] = React.useState('');
  var [error, setError] = React.useState(false);
  var [shake, setShake] = React.useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (input === PIN) {
      localStorage.setItem(SESSION_KEY, '1');
      props.onUnlock();
    } else {
      setError(true);
      setShake(true);
      setInput('');
      setTimeout(function() { setShake(false); }, 600);
    }
  }

  function handleChange(e) {
    setError(false);
    setInput(e.target.value);
  }

  return (
    <div className="min-h-screen bg-[#0b0e1a] flex flex-col items-center justify-center gap-8">
      <img src="/btlogo.png" alt="BrosephTech" className="w-40 opacity-90" />
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white tracking-wide">Command Center</h1>
        <p className="text-sm text-white/40 mt-1">Team access only</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
        <input
          type="password"
          value={input}
          onChange={handleChange}
          placeholder="Enter PIN"
          maxLength={6}
          autoFocus
          className={'text-center text-2xl tracking-[0.4em] w-40 px-4 py-3 rounded-xl bg-[#13172a] border text-white outline-none transition-all ' + (error ? 'border-red-500' : 'border-white/10 focus:border-[#5BA3DB]') + (shake ? ' animate-pulse' : '')}
        />
        {error && <p className="text-red-400 text-sm">Wrong PIN</p>}
        <button
          type="submit"
          className="px-8 py-2.5 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] text-white font-semibold text-sm transition-colors"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}

function BrosephTechScreen() {
  var [unlocked, setUnlocked] = React.useState(function() {
    return localStorage.getItem(SESSION_KEY) === '1';
  });
  var [tab, setTab] = React.useState('board');

  function handleUnlock() {
    setUnlocked(true);
  }

  function handleLock() {
    localStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
  }

  if (!unlocked) {
    return <PinGate onUnlock={handleUnlock} />;
  }

  return (
    <div className="min-h-screen bg-[#0b0e1a] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0f1320]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/btlogo.png" alt="BrosephTech" className="h-8" />
            <div>
              <h1 className="text-lg font-bold text-white leading-none">BrosephTech</h1>
              <p className="text-xs text-white/40 leading-none mt-0.5">Command Center</p>
            </div>
          </div>
          <button
            onClick={handleLock}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <Icon name="lock" className="text-base" />
            Lock
          </button>
        </div>
        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map(function(t) {
            var active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={function() { setTab(t.id); }}
                className={'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ' + (active ? 'border-[#E8A020] text-[#E8A020]' : 'border-transparent text-white/40 hover:text-white/70')}
              >
                <Icon name={t.icon} className="text-lg" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === 'board' && <BTBoard />}
        {tab === 'metrics' && <BTMetrics />}
        {tab === 'sops' && <BTSops />}
      </div>
    </div>
  );
}

export default BrosephTechScreen;
```

Note: `BTBoard`, `BTMetrics`, `BTSops` are stub imports — create placeholder files in `src/screens/brosephtech/` before running:

```jsx
// src/screens/brosephtech/BTBoard.jsx (placeholder)
import React from 'react';
export default function BTBoard() { return <div className="text-white">Board coming</div>; }

// src/screens/brosephtech/BTMetrics.jsx (placeholder)
import React from 'react';
export default function BTMetrics() { return <div className="text-white">Metrics coming</div>; }

// src/screens/brosephtech/BTSops.jsx (placeholder)
import React from 'react';
export default function BTSops() { return <div className="text-white">SOPs coming</div>; }
```

- [ ] **Step 2: Verify in browser**

Visit `http://localhost:5173/brosephtech`. Expected:
- PIN gate visible with BT logo
- Enter `9999` -> "Wrong PIN" message appears
- Enter `1738` -> unlocks, header with logo + 3 tabs visible
- Tab clicks switch content
- Lock button re-shows PIN gate

- [ ] **Step 3: Commit**

```bash
git add src/screens/BrosephTechScreen.jsx src/screens/brosephtech/
git commit -m "feat(brosephtech): PIN gate + tab shell"
```

---

## Task 4: BTBoard.jsx — Kanban Content Board

**Files:**
- Modify: `src/screens/brosephtech/BTBoard.jsx`
- Uses: Supabase `bt_content_cards` table

This is the core feature. 6 columns, drag-to-move cards, add/edit/delete cards with a modal form.

**Columns definition:**
```js
var COLUMNS = [
  { id: 'ideas',      label: 'Ideas',      icon: 'lightbulb',     color: '#8B5CF6' },
  { id: 'writing',    label: 'Writing',    icon: 'edit_note',     color: '#3B82F6' },
  { id: 'production', label: 'Production', icon: 'movie',         color: '#F59E0B' },
  { id: 'review',     label: 'Review',     icon: 'visibility',    color: '#EC4899' },
  { id: 'published',  label: 'Published',  icon: 'check_circle',  color: '#10B981' },
  { id: 'archive',    label: 'Archive',    icon: 'archive',       color: '#6B7280' },
];
```

**Team members:**
```js
var TEAM = ['Levitate', 'Co-Founder', 'Founder 3', 'Scriptwriter', 'Editor', 'GFX'];
```

**Priority colors:**
```js
var PRIORITY_COLORS = { high: '#EF4444', medium: '#F59E0B', low: '#6B7280' };
```

**Content types:**
```js
var CONTENT_TYPES = ['short', 'longform', 'collab'];
```

**Platforms:**
```js
var PLATFORMS = ['youtube', 'tiktok', 'both'];
```

- [ ] **Step 1: Write the full BTBoard.jsx**

Replace `src/screens/brosephtech/BTBoard.jsx` entirely:

```jsx
import React from 'react';
import { supabase } from '../../lib/supabase';

var COLUMNS = [
  { id: 'ideas',      label: 'Ideas',      icon: 'lightbulb',    color: '#8B5CF6' },
  { id: 'writing',    label: 'Writing',    icon: 'edit_note',    color: '#3B82F6' },
  { id: 'production', label: 'Production', icon: 'movie',        color: '#F59E0B' },
  { id: 'review',     label: 'Review',     icon: 'visibility',   color: '#EC4899' },
  { id: 'published',  label: 'Published',  icon: 'check_circle', color: '#10B981' },
  { id: 'archive',    label: 'Archive',    icon: 'archive',      color: '#6B7280' },
];

var TEAM = ['Levitate', 'Co-Founder', 'Founder 3', 'Scriptwriter', 'Editor', 'GFX'];
var PRIORITY_COLORS = { high: '#EF4444', medium: '#F59E0B', low: '#6B7280' };
var CONTENT_TYPE_LABELS = { short: 'Short', longform: 'Long-form', collab: 'Collab' };
var PLATFORM_LABELS = { youtube: 'YT', tiktok: 'TT', both: 'YT+TT' };

var EMPTY_FORM = {
  title: '',
  description: '',
  column_id: 'ideas',
  content_type: 'short',
  platform: 'both',
  assignee: '',
  priority: 'medium',
  due_date: '',
};

function Icon(props) {
  return (
    <span className={'material-symbols-outlined ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

function CardModal(props) {
  var [form, setForm] = React.useState(props.initial || EMPTY_FORM);
  var [saving, setSaving] = React.useState(false);

  function set(field, value) {
    setForm(function(prev) {
      var next = Object.assign({}, prev);
      next[field] = value;
      return next;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    props.onSave(form, function() { setSaving(false); });
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={props.onClose}>
      <div className="bg-[#13172a] border border-white/10 rounded-2xl w-full max-w-md p-6" onClick={function(e) { e.stopPropagation(); }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">{props.initial ? 'Edit Card' : 'Add Card'}</h3>
          <button onClick={props.onClose} className="text-white/40 hover:text-white">
            <Icon name="close" className="text-xl" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-white/40 mb-1 block">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={function(e) { set('title', e.target.value); }}
              className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB]"
              placeholder="e.g. Best augments tier list"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Column</label>
              <select
                value={form.column_id}
                onChange={function(e) { set('column_id', e.target.value); }}
                className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              >
                {COLUMNS.map(function(c) {
                  return <option key={c.id} value={c.id}>{c.label}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Priority</label>
              <select
                value={form.priority}
                onChange={function(e) { set('priority', e.target.value); }}
                className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Type</label>
              <select
                value={form.content_type}
                onChange={function(e) { set('content_type', e.target.value); }}
                className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              >
                <option value="short">Short</option>
                <option value="longform">Long-form</option>
                <option value="collab">Collab</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Platform</label>
              <select
                value={form.platform}
                onChange={function(e) { set('platform', e.target.value); }}
                className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              >
                <option value="both">YT + TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Assignee</label>
              <select
                value={form.assignee}
                onChange={function(e) { set('assignee', e.target.value); }}
                className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              >
                <option value="">Unassigned</option>
                {TEAM.map(function(m) {
                  return <option key={m} value={m}>{m}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Due date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={function(e) { set('due_date', e.target.value); }}
                className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1 block">Notes</label>
            <textarea
              value={form.description}
              onChange={function(e) { set('description', e.target.value); }}
              rows={3}
              className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none resize-none"
              placeholder="Script ideas, references, links..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] disabled:opacity-50 text-white font-semibold text-sm transition-colors"
            >
              {saving ? 'Saving...' : (props.initial ? 'Save changes' : 'Add card')}
            </button>
            {props.onDelete && (
              <button
                type="button"
                onClick={props.onDelete}
                className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function KanbanCard(props) {
  var card = props.card;

  function handleDragStart(e) {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={function() { props.onEdit(card); }}
      className="bg-[#0b0e1a] border border-white/5 rounded-xl p-3 cursor-pointer hover:border-white/15 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white text-sm font-medium leading-snug flex-1">{card.title}</p>
        <span
          className="shrink-0 w-2 h-2 rounded-full mt-1"
          style={{ backgroundColor: PRIORITY_COLORS[card.priority] || '#6B7280' }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#5BA3DB]/10 text-[#5BA3DB]">
          {CONTENT_TYPE_LABELS[card.content_type] || card.content_type}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8A020]/10 text-[#E8A020]">
          {PLATFORM_LABELS[card.platform] || card.platform}
        </span>
        {card.assignee && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/50">
            {card.assignee}
          </span>
        )}
        {card.due_date && (
          <span className="text-xs text-white/30">
            {new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  );
}

function KanbanColumn(props) {
  var col = props.col;
  var cards = props.cards;
  var [dragOver, setDragOver] = React.useState(false);

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    var cardId = e.dataTransfer.getData('cardId');
    if (cardId) props.onMoveCard(cardId, col.id);
  }

  return (
    <div className="flex flex-col min-w-[260px] max-w-[280px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="material-symbols-outlined text-base" style={{ color: col.color }}>{col.icon}</span>
        <span className="text-sm font-semibold text-white/70">{col.label}</span>
        <span className="ml-auto text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{cards.length}</span>
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={'flex flex-col gap-2.5 min-h-[200px] rounded-xl p-2 border transition-colors ' + (dragOver ? 'border-[#5BA3DB]/50 bg-[#5BA3DB]/5' : 'border-transparent')}
      >
        {cards.map(function(card) {
          return (
            <KanbanCard
              key={card.id}
              card={card}
              onEdit={props.onEditCard}
            />
          );
        })}
        <button
          onClick={function() { props.onAddCard(col.id); }}
          className="flex items-center gap-1.5 text-white/20 hover:text-white/50 text-xs py-2 px-2 rounded-lg hover:bg-white/5 transition-all mt-1"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add card
        </button>
      </div>
    </div>
  );
}

function BTBoard() {
  var [cards, setCards] = React.useState([]);
  var [loading, setLoading] = React.useState(true);
  var [modal, setModal] = React.useState(null);

  React.useEffect(function() {
    loadCards();
  }, []);

  function loadCards() {
    setLoading(true);
    supabase
      .from('bt_content_cards')
      .select('*')
      .order('created_at', { ascending: false })
      .then(function(res) {
        if (res.data) setCards(res.data);
        setLoading(false);
      });
  }

  function handleAddCard(columnId) {
    setModal({ initial: Object.assign({}, EMPTY_FORM, { column_id: columnId }) });
  }

  function handleEditCard(card) {
    setModal({ initial: card, isEdit: true });
  }

  function handleSave(form, done) {
    if (modal.isEdit) {
      supabase
        .from('bt_content_cards')
        .update({
          title: form.title,
          description: form.description,
          column_id: form.column_id,
          content_type: form.content_type,
          platform: form.platform,
          assignee: form.assignee,
          priority: form.priority,
          due_date: form.due_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', modal.initial.id)
        .then(function() {
          loadCards();
          setModal(null);
          done();
        });
    } else {
      supabase
        .from('bt_content_cards')
        .insert({
          title: form.title,
          description: form.description,
          column_id: form.column_id,
          content_type: form.content_type,
          platform: form.platform,
          assignee: form.assignee,
          priority: form.priority,
          due_date: form.due_date || null,
        })
        .then(function() {
          loadCards();
          setModal(null);
          done();
        });
    }
  }

  function handleDelete() {
    if (!modal || !modal.initial || !modal.initial.id) return;
    supabase
      .from('bt_content_cards')
      .delete()
      .eq('id', modal.initial.id)
      .then(function() {
        loadCards();
        setModal(null);
      });
  }

  function handleMoveCard(cardId, newColumnId) {
    supabase
      .from('bt_content_cards')
      .update({ column_id: newColumnId, updated_at: new Date().toISOString() })
      .eq('id', cardId)
      .then(function() { loadCards(); });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/30">
        <span className="material-symbols-outlined animate-spin text-3xl mr-3">refresh</span>
        Loading board...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Content Board</h2>
          <p className="text-sm text-white/40">{cards.length} cards total</p>
        </div>
        <button
          onClick={function() { setModal({ initial: Object.assign({}, EMPTY_FORM) }); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] text-white text-sm font-semibold transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          New card
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6">
        {COLUMNS.map(function(col) {
          var colCards = cards.filter(function(c) { return c.column_id === col.id; });
          return (
            <KanbanColumn
              key={col.id}
              col={col}
              cards={colCards}
              onAddCard={handleAddCard}
              onEditCard={handleEditCard}
              onMoveCard={handleMoveCard}
            />
          );
        })}
      </div>

      {modal && (
        <CardModal
          initial={modal.initial}
          isEdit={modal.isEdit}
          onSave={handleSave}
          onClose={function() { setModal(null); }}
          onDelete={modal.isEdit ? handleDelete : null}
        />
      )}
    </div>
  );
}

export default BTBoard;
```

- [ ] **Step 2: Verify in browser**

Visit `http://localhost:5173/brosephtech`, enter PIN `1738`, click Board tab. Expected:
- 6 columns visible with headers
- "Add card" button opens modal
- Fill form and save -> card appears in correct column
- Drag card to another column -> card moves (confirm in Supabase)
- Click card -> edit modal opens with current values
- Delete button removes card

- [ ] **Step 3: Commit**

```bash
git add src/screens/brosephtech/BTBoard.jsx
git commit -m "feat(brosephtech): Kanban board with Supabase CRUD + drag-to-move"
```

---

## Task 5: BTMetrics.jsx — Metrics Dashboard

**Files:**
- Modify: `src/screens/brosephtech/BTMetrics.jsx`
- Uses: Supabase `bt_metrics_snapshots` table

Tracks 4 metrics over time: YouTube subs, TikTok followers, Patreon subs, avg views per video.

- [ ] **Step 1: Write BTMetrics.jsx**

Replace `src/screens/brosephtech/BTMetrics.jsx` entirely:

```jsx
import React from 'react';
import { supabase } from '../../lib/supabase';

var METRICS = [
  { key: 'yt_subs',          label: 'YouTube Subs',     icon: 'play_circle',  color: '#FF0000' },
  { key: 'tiktok_followers', label: 'TikTok Followers', icon: 'music_note',   color: '#E8A020' },
  { key: 'patreon_subs',     label: 'Patreon Members',  icon: 'volunteer_activism', color: '#FF424D' },
  { key: 'avg_views',        label: 'Avg Views/Video',  icon: 'bar_chart',    color: '#5BA3DB' },
];

var EMPTY_FORM = {
  snapshot_date: new Date().toISOString().slice(0, 10),
  yt_subs: '',
  tiktok_followers: '',
  patreon_subs: '',
  avg_views: '',
  notes: '',
};

function KpiCard(props) {
  var delta = props.delta;
  var positive = delta !== null && delta > 0;
  var negative = delta !== null && delta < 0;

  return (
    <div className="bg-[#13172a] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-xl" style={{ color: props.color }}>{props.icon}</span>
        <span className="text-sm text-white/50">{props.label}</span>
      </div>
      <p className="text-3xl font-bold text-white">
        {props.value !== null && props.value !== undefined ? Number(props.value).toLocaleString() : '--'}
      </p>
      {delta !== null && delta !== undefined && delta !== 0 && (
        <p className={'text-sm mt-1 ' + (positive ? 'text-emerald-400' : negative ? 'text-red-400' : 'text-white/30')}>
          {positive ? '+' : ''}{Number(delta).toLocaleString()} from last snapshot
        </p>
      )}
    </div>
  );
}

function BTMetrics() {
  var [snapshots, setSnapshots] = React.useState([]);
  var [loading, setLoading] = React.useState(true);
  var [form, setForm] = React.useState(Object.assign({}, EMPTY_FORM));
  var [saving, setSaving] = React.useState(false);
  var [showForm, setShowForm] = React.useState(false);

  React.useEffect(function() {
    loadSnapshots();
  }, []);

  function loadSnapshots() {
    setLoading(true);
    supabase
      .from('bt_metrics_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(20)
      .then(function(res) {
        if (res.data) setSnapshots(res.data);
        setLoading(false);
      });
  }

  function setField(field, value) {
    setForm(function(prev) {
      var next = Object.assign({}, prev);
      next[field] = value;
      return next;
    });
  }

  function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    supabase
      .from('bt_metrics_snapshots')
      .insert({
        snapshot_date: form.snapshot_date,
        yt_subs: parseInt(form.yt_subs) || 0,
        tiktok_followers: parseInt(form.tiktok_followers) || 0,
        patreon_subs: parseInt(form.patreon_subs) || 0,
        avg_views: parseInt(form.avg_views) || 0,
        notes: form.notes,
      })
      .then(function() {
        loadSnapshots();
        setForm(Object.assign({}, EMPTY_FORM));
        setShowForm(false);
        setSaving(false);
      });
  }

  var latest = snapshots[0] || null;
  var previous = snapshots[1] || null;

  function getDelta(key) {
    if (!latest || !previous) return null;
    return (latest[key] || 0) - (previous[key] || 0);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Channel Metrics</h2>
          <p className="text-sm text-white/40">Log snapshots to track growth over time</p>
        </div>
        <button
          onClick={function() { setShowForm(function(v) { return !v; }); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] text-white text-sm font-semibold transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Log snapshot
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {METRICS.map(function(m) {
          return (
            <KpiCard
              key={m.key}
              label={m.label}
              icon={m.icon}
              color={m.color}
              value={latest ? latest[m.key] : null}
              delta={getDelta(m.key)}
            />
          );
        })}
      </div>

      {/* Log form */}
      {showForm && (
        <div className="bg-[#13172a] border border-white/10 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Log new snapshot</h3>
          <form onSubmit={handleSave} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="col-span-2 lg:col-span-1">
              <label className="text-xs text-white/40 mb-1 block">Date</label>
              <input
                type="date"
                value={form.snapshot_date}
                onChange={function(e) { setField('snapshot_date', e.target.value); }}
                className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              />
            </div>
            {METRICS.map(function(m) {
              return (
                <div key={m.key}>
                  <label className="text-xs text-white/40 mb-1 block">{m.label}</label>
                  <input
                    type="number"
                    min="0"
                    value={form[m.key]}
                    onChange={function(e) { setField(m.key, e.target.value); }}
                    className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                    placeholder="0"
                  />
                </div>
              );
            })}
            <div className="col-span-2 lg:col-span-3">
              <label className="text-xs text-white/40 mb-1 block">Notes (optional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={function(e) { setField('notes', e.target.value); }}
                className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                placeholder="e.g. Viral short boosted TT, launched Patreon"
              />
            </div>
            <div className="col-span-2 lg:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] disabled:opacity-50 text-white font-semibold text-sm transition-colors"
              >
                {saving ? 'Saving...' : 'Save snapshot'}
              </button>
              <button
                type="button"
                onClick={function() { setShowForm(false); }}
                className="px-6 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History table */}
      {loading ? (
        <div className="text-center text-white/30 py-12">Loading...</div>
      ) : snapshots.length === 0 ? (
        <div className="text-center text-white/30 py-16">
          <span className="material-symbols-outlined text-4xl mb-3 block">bar_chart</span>
          No snapshots yet. Log your first one above.
        </div>
      ) : (
        <div className="bg-[#13172a] border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-white/40 font-medium px-5 py-3">Date</th>
                <th className="text-right text-white/40 font-medium px-4 py-3">YT Subs</th>
                <th className="text-right text-white/40 font-medium px-4 py-3">TikTok</th>
                <th className="text-right text-white/40 font-medium px-4 py-3">Patreon</th>
                <th className="text-right text-white/40 font-medium px-4 py-3">Avg Views</th>
                <th className="text-left text-white/40 font-medium px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map(function(s, i) {
                return (
                  <tr key={s.id} className={'border-b border-white/5 last:border-0 ' + (i === 0 ? 'bg-[#5BA3DB]/5' : '')}>
                    <td className="px-5 py-3 text-white font-medium">
                      {new Date(s.snapshot_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right text-white">{(s.yt_subs || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-white">{(s.tiktok_followers || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-white">{(s.patreon_subs || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-white">{(s.avg_views || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-white/40 text-xs">{s.notes || '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default BTMetrics;
```

- [ ] **Step 2: Verify in browser**

Click Metrics tab. Expected:
- 4 KPI cards showing `--` (no snapshots yet)
- "Log snapshot" button opens form
- Fill in numbers and save -> KPI cards update, row appears in history table
- Log a second snapshot -> delta shows correctly (+/- vs previous)

- [ ] **Step 3: Commit**

```bash
git add src/screens/brosephtech/BTMetrics.jsx
git commit -m "feat(brosephtech): metrics snapshot dashboard with KPI cards + history table"
```

---

## Task 6: BTSops.jsx — TFT Content Production SOPs

**Files:**
- Modify: `src/screens/brosephtech/BTSops.jsx`

Hardcoded SOPs for the 3 main content types. Expandable accordion cards. No backend needed.

- [ ] **Step 1: Write BTSops.jsx**

Replace `src/screens/brosephtech/BTSops.jsx` entirely:

```jsx
import React from 'react';

var SOPS = [
  {
    id: 'short',
    title: 'Short-Form Production',
    subtitle: 'TikTok / YouTube Shorts (30-90s)',
    icon: 'bolt',
    color: '#E8A020',
    owner: 'Levitate -> Scriptwriter -> Editor',
    steps: [
      { role: 'Levitate', action: 'Pick topic: trending TFT mechanic, patch highlight, or hot meta build. Must be explainable in under 60 seconds.' },
      { role: 'Scriptwriter', action: 'Write 30-60 second script. Hook must land in first 3 seconds ("This augment combo is broken" / "You need to stop ignoring this"). Max 120 words.' },
      { role: 'Levitate', action: 'Approve script or request changes. One revision cycle max.' },
      { role: 'Levitate', action: 'Record gameplay showing exactly what the script describes. Minimum 2x the footage length you need (for edit cuts).' },
      { role: 'Editor', action: 'Edit: cut dead time, add captions (auto-gen + verify), trending audio if appropriate, BrosephTech intro card (max 1s). Export 9:16 1080x1920.' },
      { role: 'GFX', action: 'Design TikTok cover frame if needed (platform shows first frame as thumbnail). Bold text + clear subject.' },
      { role: 'Levitate', action: 'Upload to TikTok + YouTube Shorts. Schedule for peak time (8-9pm CET) or post immediately if topic is time-sensitive.' },
      { role: 'Levitate', action: 'Monitor first 2 hours. Reply to all comments in first hour. Check view velocity at 30 min and 2 hrs. Log avg views in Metrics tab after 48 hrs.' },
    ],
    tips: [
      'Avoid intros over 2 seconds — the algorithm punishes slow hooks',
      'If views stall under 500 in first hour, consider boosting with a Patreon teaser',
      'Use trending TFT search terms in title and first comment',
    ],
  },
  {
    id: 'longform',
    title: 'Long-Form Production',
    subtitle: 'YouTube (10-20 mins)',
    icon: 'videocam',
    color: '#5BA3DB',
    owner: 'Levitate -> Scriptwriter -> Editor -> GFX',
    steps: [
      { role: 'Levitate', action: 'Topic research: what is the highest-searched TFT question right now? Check TFT Reddit, Patch notes, pro player Twitter. Confirm it has search volume before committing.' },
      { role: 'Scriptwriter', action: 'Write full script. Structure: Hook (30s) > Overview (1 min) > Deep-dive sections (bulk of video) > Summary + CTA to Patreon. Aim for 1500-2000 words for a 10-12 min video.' },
      { role: 'Levitate', action: 'Review and approve script. Annotate any gameplay cues ("show this unit combo here").' },
      { role: 'Levitate', action: 'Record gameplay clips matching script cues. Record voiceover separately for clean audio. Save all raw files to shared drive.' },
      { role: 'Editor', action: 'Edit: sync voiceover + gameplay, add lower thirds for unit/item names, BT intro (3-5s), chapter markers matching script sections, end screen (20s) with Patreon CTA. Export 16:9 1080p60.' },
      { role: 'GFX', action: 'Design YouTube thumbnail: big text, contrasting colors, max 3 elements (character/board, expression, text). A/B test two thumbnails if possible.' },
      { role: 'Levitate', action: 'SEO: title with primary keyword in first 40 chars, description with keyword in first 150 chars + full content summary, 5-8 tags, add to relevant playlist.' },
      { role: 'Levitate', action: 'Upload, set premiere for 48 hrs out or publish immediately if patch-relevant. Post teaser clip in Patreon same day. Announce on TikTok / Twitter.' },
      { role: 'Levitate', action: 'After 7 days: log avg views in Metrics tab. Note if thumbnail or title was changed mid-run.' },
    ],
    tips: [
      'Patch day videos outperform evergreen content 3:1 in first 48 hrs - prioritize speed',
      'Add chapter timestamps — they improve retention metrics',
      'Cross-promote every long-form as at least 2 Shorts clips',
    ],
  },
  {
    id: 'patreon',
    title: 'Patreon Post',
    subtitle: 'Exclusive member content',
    icon: 'volunteer_activism',
    color: '#FF424D',
    owner: 'Levitate',
    steps: [
      { role: 'Levitate', action: 'Pick exclusive content type: early access to upcoming video, detailed written guide, tier list breakdown, Q&A session, or behind-the-scenes process post.' },
      { role: 'Levitate', action: 'Draft post. Written posts: 400-800 words, images where relevant. Video posts: use unedited raw footage or early-access cut.' },
      { role: 'Levitate', action: 'Set the correct tier visibility. All-access = all tiers. Exclusive content = paid tiers only. Early access = 48-hour window before public.' },
      { role: 'Levitate', action: 'Publish and announce on Twitter/TikTok with teaser: "Full breakdown exclusive to Patreon members - link in bio". Always drive external traffic to Patreon page.' },
    ],
    tips: [
      'Post at least 2x per week to justify the membership value',
      'The best Patreon hook is content that directly helps rank up — meta guides, coaching session replays, tier lists before public release',
      'Monthly goal: 1 major exclusive guide + 4+ smaller posts',
    ],
  },
];

function SopCard(props) {
  var sop = props.sop;
  var [open, setOpen] = React.useState(false);

  return (
    <div className="bg-[#13172a] border border-white/5 rounded-2xl overflow-hidden">
      <button
        onClick={function() { setOpen(function(v) { return !v; }); }}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/2 transition-colors"
      >
        <span className="material-symbols-outlined text-2xl" style={{ color: sop.color }}>{sop.icon}</span>
        <div className="flex-1">
          <p className="text-white font-semibold">{sop.title}</p>
          <p className="text-white/40 text-sm">{sop.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/30 bg-white/5 px-2.5 py-1 rounded-full">{sop.steps.length} steps</span>
          <span className="material-symbols-outlined text-white/30">{open ? 'expand_less' : 'expand_more'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/5 px-5 pb-5">
          <p className="text-xs text-white/30 mt-4 mb-4">
            <span className="font-semibold text-white/50">Owner flow:</span> {sop.owner}
          </p>
          <ol className="flex flex-col gap-3">
            {sop.steps.map(function(step, i) {
              return (
                <li key={i} className="flex gap-4">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ backgroundColor: sop.color + '20', color: sop.color }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">{step.role} </span>
                    <span className="text-white/80 text-sm">{step.action}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 bg-[#E8A020]/5 border border-[#E8A020]/15 rounded-xl p-4">
            <p className="text-xs font-semibold text-[#E8A020] mb-2">Pro tips</p>
            <ul className="flex flex-col gap-1.5">
              {sop.tips.map(function(tip, i) {
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="text-[#E8A020] mt-0.5">-</span>
                    {tip}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function BTSops() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Production SOPs</h2>
        <p className="text-sm text-white/40">Standard operating procedures for BrosephTech content</p>
      </div>
      <div className="flex flex-col gap-4">
        {SOPS.map(function(sop) {
          return <SopCard key={sop.id} sop={sop} />;
        })}
      </div>
    </div>
  );
}

export default BTSops;
```

- [ ] **Step 2: Verify in browser**

Click SOPs tab. Expected:
- 3 SOP cards visible (Short-Form, Long-Form, Patreon)
- Clicking each expands accordion with numbered steps, role labels, and pro tips
- Clicking again collapses

- [ ] **Step 3: Commit**

```bash
git add src/screens/brosephtech/BTSops.jsx
git commit -m "feat(brosephtech): TFT content production SOPs - short, longform, patreon"
```

---

## Task 7: Polish + Push

- [ ] **Step 1: Delete the test seed card**

Use `mcp__supabase__execute_sql`:
```sql
DELETE FROM bt_content_cards WHERE title = 'Test card - delete me';
```

- [ ] **Step 2: Full browser walkthrough**

Check all flows work end-to-end:
1. Visit `/brosephtech` from a fresh browser tab -> PIN gate visible
2. Enter wrong PIN -> error message, no access
3. Enter `1738` -> unlocks, BT header visible
4. Board tab: add a card -> confirm appears in correct column; drag to another column -> confirm moves
5. Metrics tab: log a snapshot -> KPI cards update, row in table
6. SOPs tab: all 3 accordions expand/collapse correctly
7. Lock button -> back to PIN gate

- [ ] **Step 3: Final commit + push**

```bash
git add -A
git commit -m "feat(brosephtech): BrosephTech Command Center - PIN gate, Kanban, Metrics, SOPs"
git push
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] PIN gate (1738) - Task 3
- [x] Kanban board (Trello-like) with Supabase - Task 4
- [x] 6 columns: Ideas, Writing, Production, Review, Published, Archive - Task 4
- [x] Cards: title, type, platform, assignee, priority, due date, notes - Task 4
- [x] Drag-to-move between columns - Task 4 (HTML5 native)
- [x] Add/Edit/Delete cards - Task 4
- [x] Metrics dashboard with snapshots - Task 5
- [x] 4 KPIs: YT subs, TikTok, Patreon, avg views - Task 5
- [x] Growth delta (vs previous snapshot) - Task 5
- [x] SOP library for 3 content types - Task 6
- [x] BT brand (blue + gold from logo) - Tasks 3-6
- [x] Logo at `/btlogo.png` - Task 2
- [x] No sidebar (standalone layout) - Task 3
- [x] Route `/brosephtech` hidden from nav - Task 2

**Placeholder scan:** No TBD, TODO, or "similar to" language. All code blocks are complete.

**Type consistency:** `supabase` imported from `../../lib/supabase` consistently. Table names `bt_content_cards` and `bt_metrics_snapshots` match migrations. `column_id` field used throughout (not `columnId` or `column`).
