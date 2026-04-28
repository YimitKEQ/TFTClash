import React from 'react';
import { supabase } from '../../lib/supabase';
import BTPatchBanner from './BTPatchBanner';
import { MECHANIC_TERMS, PATCHES } from '../../lib/btset17';
import { BT_CREW, BT_CREW_NAMES, getCrewMember, resolveCrewName, cardAssignees, workloadStatus } from '../../lib/btcrew';
import useBTSync from './useBTSync';

var BOARD_TABLES = ['bt_content_cards', 'bt_card_templates'];

var TEMPLATE_FIELDS = ['title', 'description', 'column_id', 'content_type', 'platform', 'assignees', 'subtasks', 'priority', 'patch_id', 'brief'];

var COLUMNS = [
  { id: 'ideas',      label: 'Ideas',      icon: 'lightbulb',    color: '#A78BFA', accent: 'rgba(167,139,250,0.15)' },
  { id: 'writing',    label: 'Writing',    icon: 'edit_note',    color: '#5BA3DB', accent: 'rgba(91,163,219,0.15)' },
  { id: 'production', label: 'Production', icon: 'movie',        color: '#E8A020', accent: 'rgba(232,160,32,0.15)' },
  { id: 'review',     label: 'Review',     icon: 'visibility',   color: '#EC4899', accent: 'rgba(236,72,153,0.15)' },
  { id: 'published',  label: 'Published',  icon: 'check_circle', color: '#10B981', accent: 'rgba(16,185,129,0.15)' },
  { id: 'archive',    label: 'Archive',    icon: 'archive',      color: '#6B7280', accent: 'rgba(107,114,128,0.15)' },
];

var ACTIVE_COLUMN_IDS = ['ideas', 'writing', 'production', 'review'];

// Patch reaction quick-templates - dropped into Ideas column when a patch lands.
var PATCH_TEMPLATES = [
  { kind: 'short',    column: 'writing',    title: 'Patch X.Y - 60s tier list shake-up',         hook: 'These are the only comps that matter on patch X.Y.' },
  { kind: 'short',    column: 'ideas',      title: 'Patch X.Y - top 5 buffs you must abuse',     hook: 'Patch X.Y just made these 5 units broken.' },
  { kind: 'longform', column: 'writing',    title: 'Patch X.Y full breakdown',                   hook: 'Everything that changed on patch X.Y, ranked by what actually matters.' },
  { kind: 'short',    column: 'ideas',      title: 'Patch X.Y - the secret nerf nobody noticed', hook: 'Riot snuck in a nerf on patch X.Y that breaks the meta.' },
];

var PRIORITY_COLORS = { high: '#EF4444', medium: '#F59E0B', low: '#6B7280' };
var PRIORITY_LABELS = { high: 'High', medium: 'Med', low: 'Low' };

var CONTENT_TYPES = [
  { id: 'short', label: 'Short' },
  { id: 'longform', label: 'Long-form' },
  { id: 'collab', label: 'Collab' },
];

var PLATFORMS = [
  { id: 'both', label: 'YT + TT', color: '#9CA3AF' },
  { id: 'youtube', label: 'YouTube', color: '#FF0000' },
  { id: 'tiktok', label: 'TikTok', color: '#E8A020' },
];

var EMPTY_BRIEF = {
  hook: '',
  hookLine: '',
  hookOptions: [],
  talkingPoints: [],
  cta: '',
  refLinks: [],
  thumbnailIdea: '',
  titleOptions: [],
  chosenTitle: '',
  estimatedLength: '',
};

var EMPTY_FORM = {
  title: '',
  description: '',
  column_id: 'ideas',
  content_type: 'short',
  platform: 'both',
  assignee: '',
  assignees: [],
  subtasks: [],
  priority: 'medium',
  due_date: '',
  patch_id: '',
  brief: null,
};

var STALE_DAYS_THRESHOLD = 5;
var STALE_BLOCKED_COLUMNS = ['published', 'archive'];

function daysSinceIso(dateStr) {
  if (!dateStr) return null;
  var when = new Date(dateStr);
  if (isNaN(when.getTime())) return null;
  var now = new Date();
  return Math.floor((now - when) / (1000 * 60 * 60 * 24));
}

function cardStaleDays(card) {
  if (!card) return 0;
  if (STALE_BLOCKED_COLUMNS.indexOf(card.column_id) !== -1) return 0;
  var anchor = card.column_changed_at || card.updated_at || card.created_at;
  var d = daysSinceIso(anchor);
  if (d === null) return 0;
  return d >= STALE_DAYS_THRESHOLD ? d : 0;
}

function normalizeSubtasks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(function(s) {
      if (!s || typeof s !== 'object') return null;
      var text = typeof s.text === 'string' ? s.text : '';
      if (!text.trim()) return null;
      return {
        id: s.id || (Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
        text: text,
        done: !!s.done,
      };
    })
    .filter(Boolean);
}

function subtaskProgress(card) {
  var list = normalizeSubtasks(card && card.subtasks);
  if (list.length === 0) return null;
  var done = list.filter(function(s) { return s.done; }).length;
  return { done: done, total: list.length, pct: Math.round((done / list.length) * 100) };
}

var TFT_TERMS = [
  'augment', 'augments', 'comp', 'comps', 'team comp', 'reroll', 'fast 8', 'fast 9',
  'capped', 'uncapped', 'opener', 'transition', 'tempo', 'econ', 'pivot',
  'tier list', 'tierlist', 'meta', 'patch', 'item', 'items',
  'champion', 'champions', 'unit', 'units', 'trait', 'traits', 'hero augment',
  'prismatic', 'silver', 'gold', 'portal', 'portals', 'hyperroll', 'rerolls',
  'one cost', '1-cost', '2-cost', '3-cost', '4-cost', '5-cost', 'one-cost',
  'lobby', 'placement', 'climb', 'rank', 'challenger', 'gm', 'master',
  'broken', 'busted', 'nerf', 'buff', 'op', 'cheese',
].concat(MECHANIC_TERMS);

var POWER_WORDS = [
  'broken', 'busted', 'insane', 'op', 'free lp', 'win', 'wins', 'climb', 'climbing',
  'best', 'worst', 'secret', 'hidden', 'meta', 'pro', 'easy', 'simple',
  'guaranteed', 'fastest', 'must', 'never', 'always', 'killer', 'cracked',
  'overpowered', 'unstoppable', 'instant', 'ultimate', 'top', 'free',
  'destroy', 'dominate', 'crushing', 'masterclass', 'unbeatable',
];

function scoreTitle(text) {
  var raw = (text || '').trim();
  if (!raw) return { score: 0, signals: [] };
  var lower = raw.toLowerCase();
  var len = raw.length;
  var words = raw.split(/\s+/).filter(Boolean).length;
  var score = 50;
  var signals = [];

  if (len < 25) {
    score -= 12;
    signals.push({ ok: false, text: 'Too short - aim for 40-65 chars' });
  } else if (len > 75) {
    score -= 14;
    signals.push({ ok: false, text: 'Too long - cut to under 75 chars' });
  } else if (len >= 40 && len <= 65) {
    score += 14;
    signals.push({ ok: true, text: 'Length is in the sweet spot (' + len + ')' });
  } else {
    score += 4;
    signals.push({ ok: true, text: 'Length is acceptable (' + len + ')' });
  }

  if (words >= 5 && words <= 11) {
    score += 6;
    signals.push({ ok: true, text: 'Word count is scannable' });
  }

  if (/\d/.test(raw)) {
    score += 8;
    signals.push({ ok: true, text: 'Contains a number - boosts CTR' });
  }

  if (/\?$|how |why |what |when |which /i.test(raw)) {
    score += 6;
    signals.push({ ok: true, text: 'Curiosity hook (question/how/why)' });
  }

  if (/\byou\b|\byour\b/i.test(raw)) {
    score += 5;
    signals.push({ ok: true, text: 'Speaks to viewer (you/your)' });
  }

  var champHits = 0;
  for (var i = 0; i < TFT_TERMS.length; i++) {
    if (lower.indexOf(TFT_TERMS[i]) !== -1) champHits++;
  }
  if (champHits >= 1) {
    score += Math.min(champHits * 4, 10);
    signals.push({ ok: true, text: 'Specific TFT term (' + champHits + ')' });
  } else {
    score -= 6;
    signals.push({ ok: false, text: 'No TFT-specific terms - get concrete' });
  }

  var powerHits = 0;
  for (var j = 0; j < POWER_WORDS.length; j++) {
    if (lower.indexOf(POWER_WORDS[j]) !== -1) powerHits++;
  }
  if (powerHits >= 1) {
    score += Math.min(powerHits * 5, 12);
    signals.push({ ok: true, text: 'Power word (' + powerHits + ')' });
  }

  if (/patch \d|set \d|\d\.\d/i.test(raw)) {
    score += 6;
    signals.push({ ok: true, text: 'Patch/set reference - timely signal' });
  }

  var caps = raw.replace(/[^A-Z]/g, '').length;
  var letters = raw.replace(/[^A-Za-z]/g, '').length;
  if (letters > 0 && caps / letters > 0.55) {
    score -= 12;
    signals.push({ ok: false, text: 'Too many caps - reads as shouting' });
  }

  if (/!{2,}|\?{2,}/.test(raw)) {
    score -= 6;
    signals.push({ ok: false, text: 'Excess punctuation hurts trust' });
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return { score: Math.round(score), signals: signals };
}

function Icon(props) {
  return (
    <span className={'material-symbols-outlined ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

function TeamAvatar(props) {
  var raw = props.name || '';
  if (!raw) return null;
  var member = getCrewMember(raw);
  var displayName = member ? member.name : raw;
  var initial = (member ? member.initial : raw.charAt(0)).toUpperCase();
  var bg = member ? member.color : '#6B7280';
  var size = props.size || 22;
  var fontSize = size >= 36 ? 14 : size >= 28 ? 12 : 10;
  var titleText = displayName;
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18), 0 4px 12px -4px ' + (member ? member.halo : 'rgba(0,0,0,0.4)'),
        fontSize: fontSize,
        letterSpacing: '0.02em',
      }}
      title={titleText}
    >
      {initial}
    </div>
  );
}

function CrewPicker(props) {
  var raw = Array.isArray(props.value) ? props.value : (props.value ? [props.value] : []);
  var selected = {};
  raw.forEach(function(value) {
    var name = resolveCrewName(value);
    if (name) selected[name] = true;
  });
  var anySelected = Object.keys(selected).length > 0;

  function emit(nextSet) {
    var ordered = BT_CREW
      .filter(function(m) { return nextSet[m.name]; })
      .map(function(m) { return m.name; });
    props.onChange(ordered);
  }

  function toggle(name) {
    var next = Object.assign({}, selected);
    if (next[name]) delete next[name];
    else next[name] = true;
    emit(next);
  }

  function clear() {
    emit({});
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={clear}
        className={'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-all ' + (!anySelected ? 'border-white/30 bg-white/10 text-white' : 'border-white/8 text-white/40 hover:text-white/70 hover:border-white/15')}
      >
        <span className="material-symbols-outlined text-[14px]">person_off</span>
        Unassigned
      </button>
      {BT_CREW.map(function(m) {
        var active = !!selected[m.name];
        return (
          <button
            key={m.id}
            type="button"
            onClick={function() { toggle(m.name); }}
            className={'flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-semibold transition-all ' + (active ? '' : 'border-white/8 text-white/55 hover:text-white/90 hover:border-white/20')}
            style={active ? {
              borderColor: m.color + '99',
              background: m.accent,
              color: '#fff',
              boxShadow: '0 4px 16px -6px ' + m.halo,
            } : {}}
            title={m.name + (active ? ' (assigned)' : '')}
          >
            <TeamAvatar name={m.name} size={20} />
            <span>{m.name}</span>
            {active && <span className="material-symbols-outlined text-[12px] opacity-80">check</span>}
          </button>
        );
      })}
    </div>
  );
}

function AvatarStack(props) {
  var names = Array.isArray(props.names) ? props.names : [];
  if (names.length === 0) return null;
  var size = props.size || 22;
  var overlap = props.overlap == null ? 8 : props.overlap;
  var max = props.max || 4;
  var visible = names.slice(0, max);
  var extra = names.length - visible.length;
  return (
    <span className="inline-flex items-center" title={names.join(', ')}>
      {visible.map(function(name, i) {
        return (
          <span
            key={name + i}
            style={{
              marginLeft: i === 0 ? 0 : -overlap,
              zIndex: visible.length - i,
              borderRadius: '999px',
              boxShadow: '0 0 0 2px rgba(13,17,32,0.95)',
              display: 'inline-block',
            }}
          >
            <TeamAvatar name={name} size={size} />
          </span>
        );
      })}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center font-bold text-white/80 bg-white/10 rounded-full"
          style={{
            width: size,
            height: size,
            fontSize: 10,
            marginLeft: -overlap,
            boxShadow: '0 0 0 2px rgba(13,17,32,0.95)',
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

function CrewFilterStrip(props) {
  var current = props.value || '';
  var meName = 'Levitate';
  var meActive = current === meName;
  var meCount = props.counts ? (props.counts[meName] || 0) : 0;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
      <button
        type="button"
        onClick={function() { props.onChange(''); }}
        className={'shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full border text-[11px] font-semibold transition-all ' + (!current ? 'border-white/30 bg-white/10 text-white' : 'border-white/10 text-white/55 hover:text-white hover:border-white/20')}
      >
        <span className="material-symbols-outlined text-[15px]">groups</span>
        All
      </button>
      <button
        type="button"
        onClick={function() { props.onChange(meActive ? '' : meName); }}
        className={'shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full border text-[11px] font-semibold transition-all ' + (meActive ? '' : 'border-white/10 text-white/65 hover:text-white hover:border-white/25')}
        style={meActive ? {
          borderColor: 'rgba(91,163,219,0.75)',
          background: 'linear-gradient(135deg, rgba(91,163,219,0.25), rgba(167,139,250,0.2))',
          color: '#fff',
          boxShadow: '0 4px 16px -6px rgba(91,163,219,0.6)',
        } : {}}
        title="Only cards assigned to me"
      >
        <span className="material-symbols-outlined text-[15px]">person</span>
        My cards
        <span className="px-1.5 rounded-full bg-white/10 text-[10px] tabular-nums">{meCount}</span>
      </button>
      {BT_CREW.map(function(m) {
        var count = props.counts ? (props.counts[m.name] || 0) : 0;
        var active = current === m.name;
        return (
          <button
            key={m.id}
            type="button"
            onClick={function() { props.onChange(active ? '' : m.name); }}
            className={'shrink-0 inline-flex items-center gap-1.5 px-2 h-9 rounded-full border text-[11px] font-semibold transition-all ' + (active ? '' : 'border-white/10 text-white/65 hover:text-white hover:border-white/25')}
            style={active ? {
              borderColor: m.color + '99',
              background: m.accent,
              color: '#fff',
              boxShadow: '0 4px 16px -6px ' + m.halo,
            } : {}}
            title={m.name + ' (' + count + ' active)'}
          >
            <TeamAvatar name={m.name} size={22} />
            <span className="hidden md:inline">{m.name}</span>
            <span className="px-1.5 rounded-full bg-white/10 text-[10px] tabular-nums">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function CrewWorkload(props) {
  var cards = props.cards || [];
  var maxCap = 8;
  var rows = BT_CREW.map(function(m) {
    var memberCards = cards.filter(function(c) {
      if (ACTIVE_COLUMN_IDS.indexOf(c.column_id) === -1) return false;
      return cardAssignees(c).indexOf(m.name) !== -1;
    });
    var status = workloadStatus(memberCards.length);
    var pct = Math.min(100, Math.round((memberCards.length / maxCap) * 100));
    return { member: m, count: memberCards.length, status: status, pct: pct };
  });

  return (
    <div className="bg-[#13172a]/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-white text-sm font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#E8A020]">groups</span>
            Crew workload
          </h3>
          <p className="text-[11px] text-white/40 mt-0.5">Active cards per crew member, excluding published and archive.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {rows.map(function(row) {
          return (
            <button
              key={row.member.id}
              type="button"
              onClick={function() { if (props.onSelect) props.onSelect(row.member.name); }}
              className="text-left bg-[#0b0e1a]/60 border border-white/5 rounded-xl px-3 py-2.5 hover:border-white/15 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <TeamAvatar name={row.member.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-semibold truncate">{row.member.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-base font-bold leading-none tabular-nums">{row.count}</p>
                  <p className="text-[9px] uppercase tracking-wider font-bold mt-0.5" style={{ color: row.status.color }}>{row.status.label}</p>
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: row.pct + '%', background: row.status.color }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function daysUntilIso(dateStr) {
  if (!dateStr) return null;
  var target = new Date(dateStr + 'T00:00:00');
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((target - now) / 86400000);
}

function PatchWarRoom(props) {
  var nextPatch = null;
  var nextPatchDays = null;
  for (var i = 0; i < PATCHES.length; i += 1) {
    var d = daysUntilIso(PATCHES[i].date);
    if (d != null && d >= -2 && d <= 5) {
      nextPatch = PATCHES[i];
      nextPatchDays = d;
      break;
    }
  }
  if (!nextPatch) return null;

  var existing = (props.cards || []).filter(function(c) {
    return c.patch_id && c.patch_id.indexOf(nextPatch.label) !== -1;
  }).length;

  var label = nextPatchDays > 0
    ? nextPatch.label + ' lands in ' + nextPatchDays + ' day' + (nextPatchDays === 1 ? '' : 's')
    : nextPatchDays === 0 ? nextPatch.label + ' is live today' : nextPatch.label + ' shipped ' + Math.abs(nextPatchDays) + 'd ago - keep cooking';

  function handleQuickAdd(template) {
    if (!props.onCreate) return;
    var resolvedTitle = template.title.replace(/X\.Y/g, nextPatch.label);
    props.onCreate({
      column_id: template.column,
      content_type: template.kind,
      platform: template.kind === 'longform' ? 'youtube' : 'both',
      title: resolvedTitle,
      patch_id: nextPatch.label,
      priority: 'high',
      brief: { hookLine: template.hook.replace(/X\.Y/g, nextPatch.label) },
    });
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[#E8A020]/30 bg-gradient-to-br from-[#1a1305] via-[#13172a] to-[#0b0e1a] p-4 mb-5"
      style={{ boxShadow: '0 12px 36px -10px rgba(232,160,32,0.35), inset 0 1px 0 rgba(255,255,255,0.08)' }}
    >
      <div
        className="pointer-events-none absolute -top-12 -right-12 w-56 h-56 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(232,160,32,0.35), transparent 70%)', filter: 'blur(20px)' }}
      />
      <div className="relative flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-[#E8A020]/40"
            style={{ background: 'rgba(232,160,32,0.18)' }}
          >
            <span className="material-symbols-outlined text-[#FFD487]">rocket_launch</span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#E8A020] font-bold">Patch war room</p>
            <p className="text-white text-base font-bold leading-tight mt-0.5">{label}</p>
            <p className="text-[11px] text-white/55 mt-0.5">
              {existing > 0 ? existing + ' patch card' + (existing === 1 ? '' : 's') + ' already on the board' : 'No patch coverage queued yet - drop a template'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-bold">Drop {nextPatch.label}</p>
        </div>
      </div>
      <div className="relative mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PATCH_TEMPLATES.map(function(t, i) {
          var resolvedTitle = t.title.replace(/X\.Y/g, nextPatch.label);
          return (
            <button
              key={'tpl-' + i}
              type="button"
              onClick={function() { handleQuickAdd(t); }}
              className="text-left bg-[#0b0e1a]/60 border border-white/8 hover:border-[#E8A020]/40 rounded-xl px-3 py-2 transition-all flex items-center gap-2.5"
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold uppercase"
                style={{ background: t.kind === 'longform' ? 'rgba(91,163,219,0.18)' : 'rgba(232,160,32,0.18)', color: t.kind === 'longform' ? '#5BA3DB' : '#E8A020' }}
              >
                {t.kind === 'longform' ? 'LF' : 'SH'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-white text-[12px] font-semibold truncate">{resolvedTitle}</p>
                <p className="text-[10px] text-white/45 truncate">Drop into {t.column}</p>
              </div>
              <span className="material-symbols-outlined text-white/50 text-[18px]">add</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IdeaCaptureFAB(props) {
  var [open, setOpen] = React.useState(false);
  var [text, setText] = React.useState('');
  var [assignees, setAssignees] = React.useState([]);
  var [saving, setSaving] = React.useState(false);
  var inputRef = React.useRef(null);

  React.useEffect(function() {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setText('');
    setAssignees([]);
  }

  function submit() {
    var trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    props.onCapture({ title: trimmed, assignees: assignees }, function(ok) {
      setSaving(false);
      if (ok) close();
    });
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') close();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={function() { setOpen(true); }}
        className="fixed z-30 right-4 sm:right-8 bottom-24 sm:bottom-8 w-14 h-14 rounded-full flex items-center justify-center text-white transition-all hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, rgba(232,160,32,0.95), rgba(239,139,140,0.95))',
          boxShadow: '0 16px 40px -10px rgba(232,160,32,0.6), inset 0 1px 0 rgba(255,255,255,0.45), 0 0 0 1px rgba(255,255,255,0.18)',
        }}
        title="Quick idea capture"
      >
        <span className="material-symbols-outlined text-2xl">bolt</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={close}>
      <div
        className="w-full sm:max-w-md mx-2 mb-2 sm:mb-0 rounded-t-3xl sm:rounded-3xl border border-white/15 backdrop-blur-2xl"
        style={{ background: 'rgba(13,17,32,0.85)', boxShadow: '0 24px 60px -10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.18)' }}
        onClick={function(e) { e.stopPropagation(); }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#E8A020]/20 text-[#FFD487]">
              <span className="material-symbols-outlined text-base">bolt</span>
            </span>
            <p className="text-white text-sm font-bold">Capture an idea</p>
          </div>
          <button onClick={close} className="text-white/40 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-5 pb-5">
          <textarea
            ref={inputRef}
            value={text}
            onChange={function(e) { setText(e.target.value); }}
            onKeyDown={onKey}
            placeholder="Drop the idea, hook, or angle..."
            rows={3}
            className="w-full bg-[#0b0e1a]/70 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-[#E8A020]/60 transition-colors"
          />
          <div className="mt-3">
            <p className="text-[10px] text-white/45 font-semibold uppercase tracking-wider mb-1.5">Assign to</p>
            <CrewPicker value={assignees} onChange={setAssignees} />
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-[10px] text-white/40">Lands in <strong className="text-white/70">Ideas</strong> column. Press Enter to ship.</p>
            <button
              type="button"
              onClick={submit}
              disabled={saving || !text.trim()}
              className="px-4 py-2 rounded-xl font-semibold text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{
                background: 'linear-gradient(135deg, #E8A020, #EF8B8C)',
                boxShadow: '0 8px 24px -8px rgba(232,160,32,0.5), inset 0 1px 0 rgba(255,255,255,0.4)',
              }}
            >
              {saving ? 'Saving...' : 'Drop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sel(props) {
  return (
    <select
      value={props.value}
      onChange={props.onChange}
      className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB] transition-colors"
    >
      {props.children}
    </select>
  );
}

function Inp(props) {
  return (
    <input
      type={props.type || 'text'}
      value={props.value}
      onChange={props.onChange}
      placeholder={props.placeholder}
      className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB] transition-colors"
      autoFocus={props.autoFocus}
      min={props.min}
      maxLength={props.maxLength}
    />
  );
}

function ListEditor(props) {
  var items = props.items || [];
  var [draft, setDraft] = React.useState('');

  function add() {
    var trimmed = draft.trim();
    if (!trimmed) return;
    var next = items.concat([trimmed]);
    props.onChange(next);
    setDraft('');
  }

  function remove(idx) {
    var next = items.slice();
    next.splice(idx, 1);
    props.onChange(next);
  }

  function onKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-1.5 mb-2">
        {items.length === 0 && (
          <p className="text-[11px] text-white/25 px-1">No {props.singular || 'items'} yet</p>
        )}
        {items.map(function(item, idx) {
          return (
            <div key={idx} className="flex items-start gap-2 bg-[#0b0e1a] border border-white/5 rounded-lg px-3 py-2">
              <span className="text-[11px] text-white/30 mt-0.5 font-mono">{idx + 1}</span>
              <p className="text-sm text-white/85 flex-1 leading-snug">{item}</p>
              <button
                type="button"
                onClick={function() { remove(idx); }}
                className="text-white/30 hover:text-red-400 transition-colors shrink-0"
              >
                <Icon name="close" className="text-base" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={function(e) { setDraft(e.target.value); }}
          onKeyDown={onKey}
          placeholder={props.placeholder || ('Add ' + (props.singular || 'item') + '...')}
          className="flex-1 bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB] transition-colors"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="px-3 py-2 rounded-lg bg-[#5BA3DB]/15 hover:bg-[#5BA3DB]/25 disabled:opacity-30 text-[#5BA3DB] text-xs font-semibold transition-colors flex items-center gap-1"
        >
          <Icon name="add" className="text-base" />
          Add
        </button>
      </div>
    </div>
  );
}

function ScoreMeter(props) {
  var score = props.score || 0;
  var color = score >= 75 ? '#10B981' : score >= 55 ? '#E8A020' : score >= 35 ? '#F59E0B' : '#EF4444';
  var label = score >= 75 ? 'Strong' : score >= 55 ? 'Solid' : score >= 35 ? 'Weak' : 'Re-write';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: score + '%', backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] font-bold tabular-nums" style={{ color: color }}>{score}</span>
      <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: color }}>{label}</span>
    </div>
  );
}

function TitleWorkshop(props) {
  var brief = props.brief || EMPTY_BRIEF;
  var titles = brief.titleOptions || [];
  var chosen = brief.chosenTitle || '';
  var [draft, setDraft] = React.useState('');

  var draftScore = React.useMemo(function() { return scoreTitle(draft); }, [draft]);
  var liveTitleScore = React.useMemo(function() { return scoreTitle(props.cardTitle || ''); }, [props.cardTitle]);

  function patchBrief(patch) {
    var next = Object.assign({}, brief, patch);
    props.onBriefChange(next);
  }

  function add() {
    var t = draft.trim();
    if (!t) return;
    if (titles.indexOf(t) !== -1) {
      setDraft('');
      return;
    }
    var next = titles.concat([t]);
    patchBrief({ titleOptions: next });
    setDraft('');
  }

  function remove(idx) {
    var next = titles.slice();
    next.splice(idx, 1);
    patchBrief({ titleOptions: next, chosenTitle: chosen === titles[idx] ? '' : chosen });
  }

  function pick(t) {
    patchBrief({ chosenTitle: t });
    if (props.onPickTitle) props.onPickTitle(t);
  }

  function onKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  }

  var sortedTitles = titles.slice().map(function(t) {
    return { text: t, scored: scoreTitle(t) };
  }).sort(function(a, b) { return b.scored.score - a.scored.score; });

  return (
    <div className="bg-[#0b0e1a]/60 border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-white font-semibold text-sm flex items-center gap-2">
            <Icon name="title" style={{ color: '#E8A020' }} className="text-base" />
            Title Workshop
          </h4>
          <p className="text-[11px] text-white/40 mt-0.5">Score variants and pick the strongest</p>
        </div>
        {props.cardTitle && (
          <div className="text-right">
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-0.5">Live title</p>
            <ScoreMeter score={liveTitleScore.score} />
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={draft}
          onChange={function(e) { setDraft(e.target.value); }}
          onKeyDown={onKey}
          placeholder="Type a variant and hit enter..."
          className="flex-1 bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E8A020] transition-colors"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="px-3 py-2 rounded-lg bg-[#E8A020]/15 hover:bg-[#E8A020]/25 disabled:opacity-30 text-[#E8A020] text-xs font-semibold transition-colors flex items-center gap-1"
        >
          <Icon name="add" className="text-base" />
          Score
        </button>
      </div>

      {draft.trim() && (
        <div className="mb-3 bg-[#13172a] border border-[#E8A020]/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">Live score</p>
            <ScoreMeter score={draftScore.score} />
          </div>
          <ul className="flex flex-col gap-1">
            {draftScore.signals.map(function(s, i) {
              return (
                <li key={i} className="flex items-center gap-1.5 text-[11px]">
                  <Icon
                    name={s.ok ? 'check_circle' : 'error'}
                    className={'text-sm ' + (s.ok ? 'text-emerald-400' : 'text-red-400')}
                  />
                  <span className="text-white/70">{s.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {sortedTitles.length === 0 ? (
        <p className="text-[11px] text-white/30 text-center py-3">Add 3-5 variants to compare</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sortedTitles.map(function(entry, idx) {
            var isChosen = entry.text === chosen;
            var rank = idx === 0 ? 'Top' : idx + 1;
            return (
              <div
                key={entry.text}
                className={'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ' + (isChosen ? 'bg-[#E8A020]/10 border-[#E8A020]/40' : 'bg-[#0b0e1a] border-white/5 hover:border-white/15')}
              >
                <span className="text-[10px] font-bold text-white/40 w-7 shrink-0">{rank}</span>
                <p className="text-sm text-white flex-1 leading-snug">{entry.text}</p>
                <ScoreMeter score={entry.scored.score} />
                <button
                  type="button"
                  onClick={function() { pick(entry.text); }}
                  className={'text-[10px] px-2 py-1 rounded font-semibold transition-colors ' + (isChosen ? 'bg-[#E8A020] text-[#0b0e1a]' : 'bg-white/5 hover:bg-white/15 text-white/70')}
                  title="Use as card title"
                >
                  {isChosen ? 'Chosen' : 'Use'}
                </button>
                <button
                  type="button"
                  onClick={function() { remove(titles.indexOf(entry.text)); }}
                  className="text-white/25 hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  <Icon name="close" className="text-sm" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BriefForm(props) {
  var brief = props.brief || EMPTY_BRIEF;

  function patch(patchObj) {
    var next = Object.assign({}, brief, patchObj);
    props.onChange(next);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-gradient-to-br from-[#5BA3DB]/8 to-transparent border border-[#5BA3DB]/15 rounded-xl p-4">
        <label className="text-[11px] text-[#5BA3DB] mb-1.5 block font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <Icon name="bolt" className="text-sm" />
          Hook (first 3 seconds)
        </label>
        <textarea
          value={brief.hookLine || ''}
          onChange={function(e) { patch({ hookLine: e.target.value }); }}
          rows={2}
          className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB] resize-none transition-colors"
          placeholder="The line you'll open the video with..."
        />
        <p className="text-[10px] text-white/30 mt-1.5">Pull from Studio &gt; Hook Bank for proven templates</p>
      </div>

      <div>
        <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Talking points</label>
        <ListEditor
          items={brief.talkingPoints || []}
          onChange={function(next) { patch({ talkingPoints: next }); }}
          singular="talking point"
          placeholder="Add a beat the script must cover..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">CTA / outro</label>
          <textarea
            value={brief.cta || ''}
            onChange={function(e) { patch({ cta: e.target.value }); }}
            rows={2}
            className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB] resize-none transition-colors"
            placeholder="Subscribe / try this comp / link below..."
          />
        </div>
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Thumbnail idea</label>
          <textarea
            value={brief.thumbnailIdea || ''}
            onChange={function(e) { patch({ thumbnailIdea: e.target.value }); }}
            rows={2}
            className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB] resize-none transition-colors"
            placeholder="Visual concept, text overlay, expression..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Reference links</label>
          <ListEditor
            items={brief.refLinks || []}
            onChange={function(next) { patch({ refLinks: next }); }}
            singular="link"
            placeholder="VOD, doc, tweet, screenshot..."
          />
        </div>
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Estimated runtime</label>
          <Inp
            value={brief.estimatedLength || ''}
            onChange={function(e) { patch({ estimatedLength: e.target.value }); }}
            placeholder="e.g. 8-10 min"
          />
          <p className="text-[10px] text-white/30 mt-1.5">Helps the editor block timeline</p>
        </div>
      </div>

      <TitleWorkshop
        brief={brief}
        cardTitle={props.cardTitle}
        onBriefChange={props.onChange}
        onPickTitle={props.onPickTitle}
      />
    </div>
  );
}

function SubtaskList(props) {
  var items = Array.isArray(props.items) ? props.items : [];
  var [draft, setDraft] = React.useState('');

  function emit(next) {
    props.onChange(normalizeSubtasks(next));
  }

  function add() {
    var trimmed = draft.trim();
    if (!trimmed) return;
    var next = items.concat([{
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      text: trimmed,
      done: false,
    }]);
    emit(next);
    setDraft('');
  }

  function toggle(id) {
    emit(items.map(function(s) {
      return s.id === id ? Object.assign({}, s, { done: !s.done }) : s;
    }));
  }

  function remove(id) {
    emit(items.filter(function(s) { return s.id !== id; }));
  }

  var done = items.filter(function(s) { return s.done; }).length;

  return (
    <div className="bg-[#0b0e1a] border border-white/10 rounded-lg p-2.5">
      {items.length > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#10B981] to-[#5BA3DB] transition-all"
              style={{ width: items.length === 0 ? '0%' : Math.round((done / items.length) * 100) + '%' }}
            />
          </div>
          <span className="text-[10px] text-white/50 font-semibold tabular-nums">{done}/{items.length}</span>
        </div>
      )}
      <ul className="flex flex-col gap-1 mb-2">
        {items.map(function(s) {
          return (
            <li key={s.id} className="flex items-center gap-2 group rounded-md hover:bg-white/[0.03] px-1 py-1">
              <button
                type="button"
                onClick={function() { toggle(s.id); }}
                className={'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ' + (s.done ? 'bg-[#10B981] border-[#10B981] text-white' : 'border-white/30 hover:border-white/60')}
                title={s.done ? 'Mark incomplete' : 'Mark done'}
              >
                {s.done && <span className="material-symbols-outlined text-[12px]">check</span>}
              </button>
              <span className={'flex-1 text-sm leading-snug ' + (s.done ? 'text-white/35 line-through' : 'text-white/90')}>{s.text}</span>
              <button
                type="button"
                onClick={function() { remove(s.id); }}
                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-opacity"
                title="Remove"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={function(e) { setDraft(e.target.value); }}
          onKeyDown={function(e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add subtask, press Enter"
          className="flex-1 bg-transparent border border-white/10 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/30 transition-colors"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-white bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function CardFields(props) {
  var form = props.form;
  var set = props.set;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Title *</label>
        <Inp
          value={form.title}
          onChange={function(e) { set('title', e.target.value); }}
          placeholder="e.g. Set 14 1-cost carries tier list"
          autoFocus={!props.isEdit}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Column</label>
          <Sel value={form.column_id} onChange={function(e) { set('column_id', e.target.value); }}>
            {COLUMNS.map(function(c) {
              return <option key={c.id} value={c.id}>{c.label}</option>;
            })}
          </Sel>
        </div>
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Priority</label>
          <Sel value={form.priority} onChange={function(e) { set('priority', e.target.value); }}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Sel>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Type</label>
          <Sel value={form.content_type} onChange={function(e) { set('content_type', e.target.value); }}>
            {CONTENT_TYPES.map(function(t) {
              return <option key={t.id} value={t.id}>{t.label}</option>;
            })}
          </Sel>
        </div>
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Platform</label>
          <Sel value={form.platform} onChange={function(e) { set('platform', e.target.value); }}>
            {PLATFORMS.map(function(p) {
              return <option key={p.id} value={p.id}>{p.label}</option>;
            })}
          </Sel>
        </div>
      </div>

      <div>
        <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Due date</label>
        <Inp
          type="date"
          value={form.due_date || ''}
          onChange={function(e) { set('due_date', e.target.value); }}
        />
      </div>

      <div>
        <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Assigned crew</label>
        <CrewPicker value={cardAssignees(form)} onChange={function(v) { set('assignees', v); }} />
        <p className="text-[10px] text-white/30 mt-1.5">Tap to add or remove. Multiple crew can co-own a card.</p>
      </div>

      <div>
        <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Subtasks</label>
        <SubtaskList
          items={normalizeSubtasks(form.subtasks)}
          onChange={function(next) { set('subtasks', next); }}
        />
      </div>

      <div>
        <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Patch tag</label>
        <Inp
          value={form.patch_id || ''}
          onChange={function(e) { set('patch_id', e.target.value); }}
          placeholder="e.g. 17.2 or set-17"
        />
        <p className="text-[10px] text-white/30 mt-1.5">Tag a patch so timeline can group cards</p>
      </div>

      <div>
        <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Notes</label>
        <textarea
          value={form.description || ''}
          onChange={function(e) { set('description', e.target.value); }}
          rows={3}
          className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB] resize-none transition-colors"
          placeholder="Quick notes, context, links..."
        />
      </div>
    </div>
  );
}

function CardModal(props) {
  var initialForm = React.useMemo(function() {
    var base = Object.assign({}, EMPTY_FORM, props.initial || {});
    base.brief = base.brief && typeof base.brief === 'object' ? Object.assign({}, EMPTY_BRIEF, base.brief) : null;
    return base;
  }, [props.initial]);

  var [form, setForm] = React.useState(initialForm);
  var [tab, setTab] = React.useState('card');
  var [saving, setSaving] = React.useState(false);
  var onCloseRef = React.useRef(props.onClose);
  onCloseRef.current = props.onClose;

  function set(field, value) {
    setForm(function(prev) {
      var next = Object.assign({}, prev);
      next[field] = value;
      return next;
    });
  }

  function setBrief(nextBrief) {
    setForm(function(prev) { return Object.assign({}, prev, { brief: nextBrief }); });
  }

  function handlePickTitle(t) {
    setForm(function(prev) { return Object.assign({}, prev, { title: t }); });
  }

  function ensureBrief() {
    if (form.brief) return;
    setBrief(Object.assign({}, EMPTY_BRIEF));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    props.onSave(form, function() { setSaving(false); });
  }

  React.useEffect(function() {
    function onKey(e) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, []);

  var briefHasContent = !!(form.brief && (
    (form.brief.hookLine && form.brief.hookLine.trim()) ||
    (form.brief.talkingPoints && form.brief.talkingPoints.length) ||
    (form.brief.cta && form.brief.cta.trim()) ||
    (form.brief.thumbnailIdea && form.brief.thumbnailIdea.trim()) ||
    (form.brief.titleOptions && form.brief.titleOptions.length)
  ));

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-stretch sm:items-center justify-center z-50 sm:p-4 animate-in fade-in" onClick={props.onClose}>
      <div
        className="bg-[#13172a] border-0 sm:border sm:border-white/10 rounded-none sm:rounded-2xl w-full sm:max-w-2xl shadow-2xl flex flex-col h-screen sm:h-auto sm:max-h-[92vh]"
        onClick={function(e) { e.stopPropagation(); }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Icon name={props.isEdit ? 'edit_note' : 'add_circle'} style={{ color: '#5BA3DB' }} />
            {props.isEdit ? 'Edit card' : 'New content card'}
          </h3>
          <button
            onClick={props.onClose}
            className="text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        <div className="px-6 flex gap-1 border-b border-white/5 overflow-x-auto">
          <button
            type="button"
            onClick={function() { setTab('card'); }}
            className={'shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-all ' + (tab === 'card' ? 'border-[#5BA3DB] text-[#5BA3DB]' : 'border-transparent text-white/40 hover:text-white/80')}
          >
            <Icon name="dashboard_customize" className="text-base" />
            Card
          </button>
          <button
            type="button"
            onClick={function() { setTab('brief'); ensureBrief(); }}
            className={'shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-all ' + (tab === 'brief' ? 'border-[#E8A020] text-[#E8A020]' : 'border-transparent text-white/40 hover:text-white/80')}
          >
            <Icon name="auto_stories" className="text-base" />
            Brief & Title
            {briefHasContent && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8A020]" title="Brief has content" />
            )}
          </button>
          {props.isEdit && (
            <button
              type="button"
              onClick={function() { setTab('comments'); }}
              className={'shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-all ' + (tab === 'comments' ? 'border-[#A78BFA] text-[#A78BFA]' : 'border-transparent text-white/40 hover:text-white/80')}
            >
              <Icon name="forum" className="text-base" />
              Comments
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === 'card' && <CardFields form={form} set={set} isEdit={props.isEdit} />}
            {tab === 'brief' && (
              <BriefForm
                brief={form.brief || EMPTY_BRIEF}
                cardTitle={form.title}
                onChange={setBrief}
                onPickTitle={handlePickTitle}
              />
            )}
            {tab === 'comments' && (
              <CommentsThread cardId={props.cardId} />
            )}
          </div>

          <div className="flex gap-2 px-6 py-4 border-t border-white/5 bg-[#0f1320]/40 rounded-b-2xl flex-wrap">
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="flex-1 min-w-[140px] py-2.5 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <React.Fragment>
                  <Icon name="progress_activity" className="animate-spin text-base" />
                  Saving
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <Icon name="check" className="text-base" />
                  {props.isEdit ? 'Save changes' : 'Add card'}
                </React.Fragment>
              )}
            </button>
            {props.onSaveAsTemplate && (
              <SaveTemplatePopover
                canSave={!!form.title.trim()}
                onSave={function(name, done) { props.onSaveAsTemplate(form, name, done); }}
              />
            )}
            {props.onDelete && (
              <button
                type="button"
                onClick={props.onDelete}
                className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors flex items-center gap-1.5"
              >
                <Icon name="delete" className="text-base" />
                <span className="hidden sm:inline">Delete</span>
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
  var [dragging, setDragging] = React.useState(false);

  function handleDragStart(e) {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.setData('sourceColumn', card.column_id);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(true);
  }

  function handleDragEnd() {
    setDragging(false);
  }

  var typeLabel = (CONTENT_TYPES.find(function(t) { return t.id === card.content_type; }) || {}).label || card.content_type;
  var platform = PLATFORMS.find(function(p) { return p.id === card.platform; }) || PLATFORMS[0];

  var overdue = false;
  if (card.due_date) {
    var due = new Date(card.due_date + 'T00:00:00');
    var today = new Date();
    today.setHours(0,0,0,0);
    overdue = due < today && !['published','archive'].includes(card.column_id);
  }

  var hasBrief = !!(card.brief && (
    (card.brief.hookLine && card.brief.hookLine.trim()) ||
    (card.brief.talkingPoints && card.brief.talkingPoints.length) ||
    (card.brief.titleOptions && card.brief.titleOptions.length)
  ));

  var assignedNames = cardAssignees(card);
  var progress = subtaskProgress(card);
  var staleDays = cardStaleDays(card);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={function() { props.onEdit(card); }}
      className={'group bg-[#0b0e1a] border rounded-xl p-3 cursor-pointer transition-all ' + (dragging ? 'opacity-40 scale-95 border-[#5BA3DB]/50' : 'border-white/5 hover:border-white/15 hover:bg-[#0e1222] hover:-translate-y-0.5')}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-white text-[13px] font-medium leading-snug flex-1">{card.title}</p>
        <span
          className="shrink-0 w-2 h-2 rounded-full mt-1.5"
          style={{ backgroundColor: PRIORITY_COLORS[card.priority] || '#6B7280' }}
          title={PRIORITY_LABELS[card.priority] + ' priority'}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#5BA3DB]/10 text-[#5BA3DB] font-semibold uppercase tracking-wide">
          {typeLabel}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: platform.color + '18',
            color: platform.color,
          }}
        >
          {platform.label}
        </span>
        {card.patch_id && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wide bg-white/5 text-white/50">
            {card.patch_id}
          </span>
        )}
        {hasBrief && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wide bg-[#E8A020]/15 text-[#E8A020] flex items-center gap-0.5" title="Brief written">
            <Icon name="auto_stories" className="text-[11px]" />
            Brief
          </span>
        )}
        {assignedNames.length > 0 && (
          <span className="ml-auto"><AvatarStack names={assignedNames} size={20} /></span>
        )}
      </div>

      {progress && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#10B981] to-[#5BA3DB] transition-all"
              style={{ width: progress.pct + '%' }}
            />
          </div>
          <span className="text-[10px] text-white/45 font-semibold tabular-nums">{progress.done}/{progress.total}</span>
        </div>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {card.due_date && (
          <div className={'flex items-center gap-1 text-[10px] ' + (overdue ? 'text-red-400' : 'text-white/30')}>
            <Icon name="calendar_today" className="text-[11px]" />
            {new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {overdue && <span className="ml-1 font-semibold">OVERDUE</span>}
          </div>
        )}
        {staleDays > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wide flex items-center gap-0.5"
            style={{ background: 'rgba(232,160,32,0.18)', color: '#FFD487' }}
            title={'No column move in ' + staleDays + ' days'}
          >
            <Icon name="hourglass_top" className="text-[11px]" />
            Stuck {staleDays}d
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

  function handleDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    var cardId = e.dataTransfer.getData('cardId');
    var sourceColumn = e.dataTransfer.getData('sourceColumn');
    if (!cardId) return;
    if (sourceColumn === col.id) return;
    props.onMoveCard(cardId, col.id);
  }

  return (
    <div className="flex flex-col min-w-[270px] max-w-[290px] w-[290px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="material-symbols-outlined text-base" style={{ color: col.color }}>{col.icon}</span>
        <span className="text-[13px] font-bold text-white tracking-wide uppercase">{col.label}</span>
        <span
          className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: col.accent, color: col.color }}
        >
          {cards.length}
        </span>
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={'flex flex-col gap-2.5 min-h-[200px] rounded-xl p-2 border-2 border-dashed transition-all ' + (dragOver ? 'border-[#5BA3DB] bg-[#5BA3DB]/5' : 'border-transparent')}
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
          className="flex items-center justify-center gap-1.5 text-white/20 hover:text-[#5BA3DB] text-xs py-2.5 px-2 rounded-lg hover:bg-[#5BA3DB]/5 transition-all border border-dashed border-white/5 hover:border-[#5BA3DB]/30"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add card
        </button>
      </div>
    </div>
  );
}

function BoardStats(props) {
  var cards = props.cards;
  var activeCards = cards.filter(function(c) { return c.column_id !== 'archive'; }).length;
  var overdueCards = cards.filter(function(c) {
    if (!c.due_date || ['published','archive'].includes(c.column_id)) return false;
    var due = new Date(c.due_date + 'T00:00:00');
    var today = new Date();
    today.setHours(0,0,0,0);
    return due < today;
  }).length;
  var inReview = cards.filter(function(c) { return c.column_id === 'review'; }).length;
  var publishedThisMonth = cards.filter(function(c) {
    if (c.column_id !== 'published') return false;
    var updated = new Date(c.updated_at || c.created_at);
    var now = new Date();
    return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear();
  }).length;

  var stats = [
    { label: 'Active', value: activeCards, color: '#5BA3DB', icon: 'bolt' },
    { label: 'In Review', value: inReview, color: '#EC4899', icon: 'visibility' },
    { label: 'Overdue', value: overdueCards, color: overdueCards > 0 ? '#EF4444' : '#6B7280', icon: 'warning' },
    { label: 'Published this month', value: publishedThisMonth, color: '#10B981', icon: 'check_circle' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map(function(s) {
        return (
          <div key={s.label} className="bg-[#13172a] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
            <Icon name={s.icon} className="text-xl" style={{ color: s.color }} />
            <div>
              <p className="text-xl font-bold text-white leading-none">{s.value}</p>
              <p className="text-[11px] text-white/40 mt-1 uppercase tracking-wide">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListCardRow(props) {
  var card = props.card;
  var col = props.col;
  var cols = props.allColumns;
  var idx = cols.findIndex(function(c) { return c.id === col.id; });
  var prevCol = idx > 0 ? cols[idx - 1] : null;
  var nextCol = idx < cols.length - 1 ? cols[idx + 1] : null;

  var typeLabel = (CONTENT_TYPES.find(function(t) { return t.id === card.content_type; }) || {}).label || card.content_type;
  var platform = PLATFORMS.find(function(p) { return p.id === card.platform; }) || PLATFORMS[0];

  var hasBrief = !!(card.brief && (
    (card.brief.hookLine && card.brief.hookLine.trim()) ||
    (card.brief.talkingPoints && card.brief.talkingPoints.length)
  ));

  var assignedNames = cardAssignees(card);
  var progress = subtaskProgress(card);
  var staleDays = cardStaleDays(card);

  function move(dir, e) {
    e.stopPropagation();
    var target = dir === 'next' ? nextCol : prevCol;
    if (target) props.onMove(card.id, target.id);
  }

  return (
    <div
      onClick={function() { props.onEdit(card); }}
      className="bg-[#0b0e1a] border border-white/5 rounded-xl p-3 active:bg-[#0e1222] transition-all flex items-center gap-3"
    >
      <span
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: col.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-medium leading-snug truncate flex-1">{card.title || 'Untitled'}</p>
          {assignedNames.length > 0 && <AvatarStack names={assignedNames} size={18} />}
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5 items-center">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#5BA3DB]/10 text-[#5BA3DB] font-semibold uppercase tracking-wide">
            {typeLabel}
          </span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
            style={{ backgroundColor: platform.color + '18', color: platform.color }}
          >
            {platform.label}
          </span>
          {card.patch_id && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide bg-white/5 text-white/50">
              {card.patch_id}
            </span>
          )}
          {hasBrief && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide bg-[#E8A020]/15 text-[#E8A020] flex items-center gap-0.5">
              <Icon name="auto_stories" className="text-[10px]" />
              Brief
            </span>
          )}
          {progress && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide bg-[#10B981]/15 text-[#10B981] flex items-center gap-0.5" title="Subtask progress">
              <Icon name="checklist" className="text-[10px]" />
              {progress.done}/{progress.total}
            </span>
          )}
          {card.due_date && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide bg-white/5 text-white/40 flex items-center gap-0.5">
              <Icon name="calendar_today" className="text-[10px]" />
              {new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {staleDays > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide flex items-center gap-0.5" style={{ background: 'rgba(232,160,32,0.18)', color: '#FFD487' }} title={'No column move in ' + staleDays + ' days'}>
              <Icon name="hourglass_top" className="text-[10px]" />
              Stuck {staleDays}d
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          disabled={!prevCol}
          onClick={function(e) { move('prev', e); }}
          className={'w-9 h-9 rounded-lg flex items-center justify-center transition-all ' + (prevCol ? 'bg-white/5 text-white/70 active:bg-white/10' : 'bg-white/[0.02] text-white/15')}
          title={prevCol ? 'Move to ' + prevCol.label : 'No previous column'}
        >
          <Icon name="chevron_left" className="text-base" />
        </button>
        <button
          type="button"
          disabled={!nextCol}
          onClick={function(e) { move('next', e); }}
          className={'w-9 h-9 rounded-lg flex items-center justify-center transition-all ' + (nextCol ? 'bg-white/5 text-white/70 active:bg-white/10' : 'bg-white/[0.02] text-white/15')}
          title={nextCol ? 'Move to ' + nextCol.label : 'No next column'}
        >
          <Icon name="chevron_right" className="text-base" />
        </button>
      </div>
    </div>
  );
}

function BoardListView(props) {
  var [openColumns, setOpenColumns] = React.useState(function() {
    var initial = {};
    props.columns.forEach(function(c) { initial[c.id] = c.id !== 'archive'; });
    return initial;
  });

  function toggle(id) {
    setOpenColumns(function(prev) {
      var next = Object.assign({}, prev);
      next[id] = !prev[id];
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {props.columns.map(function(col) {
        var colCards = props.cards.filter(function(c) { return c.column_id === col.id; });
        var open = openColumns[col.id];
        return (
          <div key={col.id} className="bg-[#13172a] border border-white/5 rounded-xl overflow-hidden">
            <button
              onClick={function() { toggle(col.id); }}
              className="w-full px-3 sm:px-4 py-3 flex items-center gap-2 active:bg-white/5 transition-colors"
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: col.color + '20', color: col.color }}
              >
                <Icon name={col.icon} className="text-base" />
              </span>
              <div className="flex-1 text-left min-w-0">
                <p className="text-white text-sm font-bold tracking-tight">{col.label}</p>
                <p className="text-[11px] text-white/40">{colCards.length} card{colCards.length === 1 ? '' : 's'}</p>
              </div>
              <button
                type="button"
                onClick={function(e) { e.stopPropagation(); props.onAddCard(col.id); }}
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center"
                title="Add card here"
              >
                <Icon name="add" className="text-base" />
              </button>
              <Icon name={open ? 'expand_less' : 'expand_more'} className="text-white/40 ml-1" />
            </button>
            {open ? (
              <div className="border-t border-white/5 p-2 sm:p-3 space-y-2">
                {colCards.length === 0 ? (
                  <p className="text-[11px] text-white/30 text-center py-3">No cards</p>
                ) : (
                  colCards.map(function(card) {
                    return (
                      <ListCardRow
                        key={card.id}
                        card={card}
                        col={col}
                        allColumns={props.columns}
                        onEdit={props.onEditCard}
                        onMove={props.onMoveCard}
                      />
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TemplatesMenu(props) {
  var [open, setOpen] = React.useState(false);
  var ref = React.useRef(null);
  var templates = props.templates || [];

  React.useEffect(function() {
    if (!open) return undefined;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return function() { document.removeEventListener('mousedown', onDocClick); };
  }, [open]);

  function handleDelete(e, id) {
    e.stopPropagation();
    if (!window.confirm('Delete this template?')) return;
    props.onDelete(id);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={function() { setOpen(!open); }}
        className="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-[#13172a] hover:bg-[#1a1f36] border border-white/10 text-white/85 text-sm font-semibold transition-all"
        title="Saved templates"
      >
        <Icon name="bookmark" className="text-base" />
        <span className="hidden sm:inline">Templates</span>
        {templates.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] tabular-nums">{templates.length}</span>
        )}
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-base text-white/40" />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-72 sm:w-80 max-h-[60vh] overflow-y-auto bg-[#13172a] border border-white/10 rounded-2xl z-30"
          style={{ boxShadow: '0 20px 50px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)' }}
        >
          <div className="px-4 pt-3 pb-2 border-b border-white/5 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-white/50">Saved templates</p>
            <span className="text-[10px] text-white/30">Click to drop a card</span>
          </div>
          {templates.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Icon name="bookmark_add" className="text-3xl text-white/20" />
              <p className="text-white/50 text-xs mt-2 font-semibold">No templates yet</p>
              <p className="text-white/30 text-[11px] mt-1">Save any card as a template from the editor footer.</p>
            </div>
          ) : (
            <ul className="py-1">
              {templates.map(function(t) {
                var payload = t.payload || {};
                var assignees = cardAssignees(payload);
                var typeMeta = CONTENT_TYPES.find(function(c) { return c.id === payload.content_type; }) || CONTENT_TYPES[0];
                var colId = payload.column_id || 'ideas';
                return (
                  <li key={t.id} className="px-1">
                    <div className="group flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-colors">
                      <button
                        type="button"
                        onClick={function() { setOpen(false); props.onCreate(t); }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-white text-sm font-semibold truncate">{t.name}</p>
                        <p className="text-[11px] text-white/40 truncate">
                          {typeMeta.label} - {colId}
                          {assignees.length > 0 && ' - ' + assignees.join(', ')}
                        </p>
                      </button>
                      {assignees.length > 0 && (
                        <AvatarStack names={assignees} size={18} max={3} />
                      )}
                      <button
                        type="button"
                        onClick={function(e) { handleDelete(e, t.id); }}
                        className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all p-1"
                        title="Delete template"
                      >
                        <Icon name="delete" className="text-base" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SaveTemplatePopover(props) {
  var [open, setOpen] = React.useState(false);
  var [name, setName] = React.useState('');
  var [busy, setBusy] = React.useState(false);
  var inputRef = React.useRef(null);

  React.useEffect(function() {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  React.useEffect(function() {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, [open]);

  function submit() {
    var trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    props.onSave(trimmed, function(ok) {
      setBusy(false);
      if (ok) {
        setName('');
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={function() { setOpen(true); }}
        disabled={!props.canSave}
        className="px-3 py-2.5 rounded-xl bg-[#E8A020]/10 hover:bg-[#E8A020]/20 disabled:opacity-30 disabled:cursor-not-allowed text-[#FFD487] text-sm font-semibold transition-colors flex items-center gap-1.5"
        title={props.canSave ? 'Save this card as a reusable template' : 'Add a title before saving as template'}
      >
        <Icon name="bookmark_add" className="text-base" />
        <span className="hidden sm:inline">Template</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-[#0b0e1a] border border-[#E8A020]/40 rounded-xl px-2 py-1.5 max-w-full">
      <Icon name="bookmark" className="text-base text-[#FFD487] shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={function(e) { setName(e.target.value); }}
        onKeyDown={function(e) {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
        }}
        placeholder="Template name..."
        className="min-w-0 flex-1 bg-transparent border-0 text-white text-sm focus:outline-none"
        maxLength={60}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!name.trim() || busy}
        className="px-2.5 py-1 rounded-lg bg-[#E8A020] hover:bg-[#FFB840] disabled:opacity-30 text-[#0b0e1a] text-xs font-bold shrink-0"
      >
        {busy ? '...' : 'Save'}
      </button>
      <button
        type="button"
        onClick={function() { setOpen(false); }}
        className="text-white/40 hover:text-white/80 px-1 shrink-0"
      >
        <Icon name="close" className="text-base" />
      </button>
    </div>
  );
}

function relativeTimeShort(iso) {
  if (!iso) return '';
  var when = new Date(iso);
  if (isNaN(when.getTime())) return '';
  var diff = (Date.now() - when.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function CommentsThread(props) {
  var cardId = props.cardId;
  var [comments, setComments] = React.useState([]);
  var [loading, setLoading] = React.useState(true);
  var [draft, setDraft] = React.useState('');
  var [busy, setBusy] = React.useState(false);
  var meName = 'Levitate';
  var endRef = React.useRef(null);

  function load() {
    if (!cardId) {
      setComments([]);
      setLoading(false);
      return;
    }
    supabase
      .from('bt_card_comments')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: true })
      .then(function(res) {
        if (res.error) {
          console.error('bt_card_comments load failed', res.error);
          setLoading(false);
          return;
        }
        setComments(res.data || []);
        setLoading(false);
      });
  }

  React.useEffect(load, [cardId]);
  useBTSync(['bt_card_comments'], load);

  React.useEffect(function() {
    if (endRef.current && comments.length > 0) {
      endRef.current.scrollIntoView({ block: 'end' });
    }
  }, [comments.length]);

  function submit() {
    var body = draft.trim();
    if (!body || busy || !cardId) return;
    setBusy(true);
    supabase
      .from('bt_card_comments')
      .insert({ card_id: cardId, author: meName, body: body })
      .then(function(res) {
        setBusy(false);
        if (res.error) {
          console.error('bt_card_comments post failed', res.error);
          return;
        }
        setDraft('');
        load();
        if (props.onPosted) props.onPosted();
      });
  }

  function remove(id) {
    if (!window.confirm('Delete this comment?')) return;
    supabase
      .from('bt_card_comments')
      .delete()
      .eq('id', id)
      .then(function(res) {
        if (res.error) {
          console.error('bt_card_comments delete failed', res.error);
          return;
        }
        load();
      });
  }

  if (!cardId) {
    return (
      <div className="text-center py-8 px-4 bg-[#0b0e1a]/60 border border-dashed border-white/8 rounded-xl">
        <Icon name="forum" className="text-3xl text-white/20" />
        <p className="text-white/45 text-sm mt-2 font-semibold">Save the card to start a comment thread</p>
        <p className="text-white/25 text-[11px] mt-1">Comments live with each card and sync to the whole crew in real-time.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 max-h-[44vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-white/30 text-xs">
            <Icon name="progress_activity" className="animate-spin text-base mr-2" />
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-white/35 text-[12px]">
            No comments yet - be the first to drop a note for the crew.
          </div>
        ) : (
          comments.map(function(c) {
            var member = getCrewMember(c.author);
            var isMine = (member && member.name === meName) || c.author === meName;
            return (
              <div key={c.id} className={'flex items-start gap-2 ' + (isMine ? 'flex-row-reverse' : '')}>
                <TeamAvatar name={c.author} size={28} />
                <div className={'min-w-0 max-w-[80%] ' + (isMine ? 'text-right' : '')}>
                  <div className={'flex items-center gap-1.5 text-[10px] text-white/40 mb-0.5 ' + (isMine ? 'justify-end' : '')}>
                    <span className="font-semibold text-white/60">{member ? member.name : (c.author || 'Unknown')}</span>
                    <span>{relativeTimeShort(c.created_at)}</span>
                    {isMine && (
                      <button
                        type="button"
                        onClick={function() { remove(c.id); }}
                        className="text-white/25 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Icon name="delete" className="text-[12px]" />
                      </button>
                    )}
                  </div>
                  <div
                    className="inline-block text-left text-[13px] text-white/90 px-3 py-2 rounded-2xl"
                    style={{
                      background: isMine ? 'linear-gradient(135deg, rgba(91,163,219,0.22), rgba(167,139,250,0.18))' : 'rgba(255,255,255,0.05)',
                      border: '1px solid ' + (isMine ? 'rgba(91,163,219,0.35)' : 'rgba(255,255,255,0.06)'),
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {c.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="flex items-end gap-2 bg-[#0b0e1a] border border-white/10 rounded-xl p-2">
        <TeamAvatar name={meName} size={28} />
        <textarea
          value={draft}
          onChange={function(e) { setDraft(e.target.value); }}
          onKeyDown={function(e) {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Drop a note for the crew. Cmd/Ctrl + Enter to send."
          rows={2}
          className="flex-1 bg-transparent text-white text-sm resize-none focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() || busy}
          className="px-3 py-2 rounded-lg bg-[#5BA3DB]/15 hover:bg-[#5BA3DB]/25 disabled:opacity-30 text-[#5BA3DB] text-sm font-semibold transition-colors flex items-center gap-1"
          title="Send (Cmd/Ctrl + Enter)"
        >
          {busy ? <Icon name="progress_activity" className="animate-spin text-base" /> : <Icon name="send" className="text-base" />}
        </button>
      </div>
    </div>
  );
}

function BottleneckHeatmap(props) {
  var cards = props.cards || [];
  var rows = ACTIVE_COLUMN_IDS.map(function(colId) {
    var col = COLUMNS.find(function(c) { return c.id === colId; });
    var inColumn = cards.filter(function(c) { return c.column_id === colId; });
    var ages = inColumn
      .map(function(c) {
        var anchor = c.column_changed_at || c.updated_at || c.created_at;
        return daysSinceIso(anchor);
      })
      .filter(function(d) { return d != null && d >= 0; });
    var avg = ages.length ? ages.reduce(function(a, b) { return a + b; }, 0) / ages.length : 0;
    var stuckCount = ages.filter(function(d) { return d >= STALE_DAYS_THRESHOLD; }).length;
    return { col: col, count: inColumn.length, avg: avg, stuck: stuckCount };
  });

  var hasAnyCards = rows.some(function(r) { return r.count > 0; });
  if (!hasAnyCards) return null;

  var maxAvg = Math.max.apply(null, rows.map(function(r) { return r.avg; }).concat([1]));
  var totalStuck = rows.reduce(function(a, r) { return a + r.stuck; }, 0);

  return (
    <div className="bg-[#13172a]/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-white text-sm font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#EF8B8C]">trending_down</span>
            Stage bottlenecks
          </h3>
          <p className="text-[11px] text-white/40 mt-0.5">Average days cards have lived in each active column. Longer bars mean things are stalling.</p>
        </div>
        {totalStuck > 0 && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5' }}
            title={totalStuck + ' card(s) stuck >= ' + STALE_DAYS_THRESHOLD + ' days across all columns'}
          >
            {totalStuck} stuck total
          </span>
        )}
      </div>
      <div className="space-y-2">
        {rows.map(function(r) {
          if (!r.col) return null;
          var pct = r.count === 0 ? 0 : Math.max(6, Math.round((r.avg / maxAvg) * 100));
          return (
            <div key={r.col.id} className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-28 shrink-0">
                <span className="material-symbols-outlined text-base" style={{ color: r.col.color }}>{r.col.icon}</span>
                <span className="text-white text-[12px] font-semibold tracking-tight">{r.col.label}</span>
              </div>
              <div className="flex-1 h-5 bg-white/5 rounded-md overflow-hidden relative">
                {r.count > 0 && (
                  <div
                    className="h-full transition-all"
                    style={{
                      width: pct + '%',
                      background: 'linear-gradient(90deg, ' + r.col.color + 'aa, ' + r.col.color + '55)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                    }}
                  />
                )}
                <div className="absolute inset-0 flex items-center px-2 text-[10px] font-bold text-white/85 tabular-nums">
                  {r.count === 0 ? 'empty' : r.avg.toFixed(1) + 'd avg'}
                </div>
              </div>
              <div className="w-24 shrink-0 flex items-center gap-1.5 justify-end">
                <span className="text-[10px] text-white/45 tabular-nums">{r.count}</span>
                {r.stuck > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5' }}
                    title={r.stuck + ' card(s) stuck >= ' + STALE_DAYS_THRESHOLD + ' days'}
                  >
                    {r.stuck} stuck
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BTBoard() {
  var [cards, setCards] = React.useState([]);
  var [templates, setTemplates] = React.useState([]);
  var [loading, setLoading] = React.useState(true);
  var [modal, setModal] = React.useState(null);
  var [filterAssignee, setFilterAssignee] = React.useState('');
  var [view, setView] = React.useState(function() {
    if (typeof window === 'undefined') return 'kanban';
    return window.innerWidth < 640 ? 'list' : 'kanban';
  });

  React.useEffect(function() {
    loadCards();
    loadTemplates();
  }, []);

  useBTSync(BOARD_TABLES, function() {
    loadCards();
    loadTemplates();
  });

  function loadCards() {
    supabase
      .from('bt_content_cards')
      .select('*')
      .order('created_at', { ascending: false })
      .then(function(res) {
        if (res.error) {
          console.error('bt_content_cards load failed', res.error);
          setLoading(false);
          return;
        }
        setCards(res.data || []);
        setLoading(false);
      });
  }

  function loadTemplates() {
    supabase
      .from('bt_card_templates')
      .select('*')
      .order('created_at', { ascending: false })
      .then(function(res) {
        if (res.error) {
          console.error('bt_card_templates load failed', res.error);
          return;
        }
        setTemplates(res.data || []);
      });
  }

  function handleAddCard(columnId) {
    setModal({ initial: Object.assign({}, EMPTY_FORM, { column_id: columnId || 'ideas' }), isEdit: false });
  }

  function handleEditCard(card) {
    setModal({ initial: card, isEdit: true });
  }

  function handleSave(form, done) {
    var assignees = cardAssignees(form);
    var subtasks = normalizeSubtasks(form.subtasks);
    var payload = {
      title: form.title,
      description: form.description,
      column_id: form.column_id,
      content_type: form.content_type,
      platform: form.platform,
      assignee: assignees[0] || '',
      assignees: assignees,
      subtasks: subtasks,
      priority: form.priority,
      due_date: form.due_date || null,
      patch_id: form.patch_id || null,
      brief: form.brief || null,
    };
    var editId = form.id || null;

    function onWriteComplete(res) {
      if (res && res.error) {
        console.error('bt_content_cards write failed', res.error);
        done();
        return;
      }
      loadCards();
      setModal(null);
      done();
    }

    if (editId) {
      payload.updated_at = new Date().toISOString();
      supabase
        .from('bt_content_cards')
        .update(payload)
        .eq('id', editId)
        .then(onWriteComplete);
    } else {
      supabase
        .from('bt_content_cards')
        .insert(payload)
        .then(onWriteComplete);
    }
  }

  function handleDelete() {
    if (!modal || !modal.initial || !modal.initial.id) return;
    var deleteId = modal.initial.id;
    supabase
      .from('bt_content_cards')
      .delete()
      .eq('id', deleteId)
      .then(function(res) {
        if (res.error) {
          console.error('bt_content_cards delete failed', res.error);
          return;
        }
        loadCards();
        setModal(null);
      });
  }

  function handleMoveCard(cardId, newColumnId) {
    supabase
      .from('bt_content_cards')
      .update({ column_id: newColumnId, updated_at: new Date().toISOString() })
      .eq('id', cardId)
      .then(function(res) {
        if (res.error) {
          console.error('bt_content_cards move failed', res.error);
          return;
        }
        loadCards();
      });
  }

  function handleQuickCapture(payload, done) {
    var assignees = Array.isArray(payload.assignees) ? payload.assignees : (payload.assignee ? [payload.assignee] : []);
    var insertPayload = Object.assign({}, EMPTY_FORM, {
      title: payload.title,
      column_id: 'ideas',
      assignee: assignees[0] || '',
      assignees: assignees,
      brief: null,
    });
    delete insertPayload.id;
    supabase
      .from('bt_content_cards')
      .insert(insertPayload)
      .then(function(res) {
        if (res.error) {
          console.error('bt_content_cards quick capture failed', res.error);
          done(false);
          return;
        }
        loadCards();
        done(true);
      });
  }

  function handlePatchTemplateCreate(template) {
    var insertPayload = Object.assign({}, EMPTY_FORM, template);
    delete insertPayload.id;
    supabase
      .from('bt_content_cards')
      .insert(insertPayload)
      .then(function(res) {
        if (res.error) {
          console.error('bt_content_cards patch template failed', res.error);
          return;
        }
        loadCards();
      });
  }

  function handleCreateFromTemplate(template) {
    var payload = (template && template.payload) || {};
    var base = Object.assign({}, EMPTY_FORM, payload);
    delete base.id;
    base.due_date = '';
    setModal({ initial: base, isEdit: false });
  }

  function handleDeleteTemplate(id) {
    supabase
      .from('bt_card_templates')
      .delete()
      .eq('id', id)
      .then(function(res) {
        if (res.error) {
          console.error('bt_card_templates delete failed', res.error);
          return;
        }
        loadTemplates();
      });
  }

  function handleSaveAsTemplate(form, name, done) {
    var trimmedName = (name || '').trim();
    if (!trimmedName) { done(false); return; }
    var assignees = cardAssignees(form);
    var subtasks = normalizeSubtasks(form.subtasks);
    var payload = {};
    TEMPLATE_FIELDS.forEach(function(field) {
      if (field === 'assignees') payload.assignees = assignees;
      else if (field === 'subtasks') payload.subtasks = subtasks.map(function(s) { return { id: s.id, text: s.text, done: false }; });
      else payload[field] = form[field] == null ? null : form[field];
    });
    supabase
      .from('bt_card_templates')
      .insert({ name: trimmedName, payload: payload, created_by: 'Levitate' })
      .then(function(res) {
        if (res.error) {
          console.error('bt_card_templates insert failed', res.error);
          done(false);
          return;
        }
        loadTemplates();
        done(true);
      });
  }

  var modalRef = React.useRef(modal);
  modalRef.current = modal;

  React.useEffect(function() {
    function onKey(e) {
      if (modalRef.current) return;
      if (e.key === 'n' && e.target && !e.target.matches('input, textarea, select')) {
        e.preventDefault();
        setModal({ initial: Object.assign({}, EMPTY_FORM, { column_id: 'ideas' }), isEdit: false });
      }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/30">
        <Icon name="progress_activity" className="animate-spin text-3xl mr-3" />
        Loading board...
      </div>
    );
  }

  var visibleCards = filterAssignee
    ? cards.filter(function(c) { return cardAssignees(c).indexOf(filterAssignee) !== -1; })
    : cards;

  var crewCounts = {};
  BT_CREW_NAMES.forEach(function(n) { crewCounts[n] = 0; });
  cards.forEach(function(c) {
    if (ACTIVE_COLUMN_IDS.indexOf(c.column_id) === -1) return;
    cardAssignees(c).forEach(function(name) {
      if (crewCounts[name] == null) crewCounts[name] = 0;
      crewCounts[name] += 1;
    });
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Subtle, system-ui, sans-serif' }}>Content Board</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {cards.length} cards total
            {filterAssignee && ' - filtered: ' + filterAssignee}
            <span className="hidden sm:inline ml-3 text-[11px] text-white/25">Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-white/40">N</kbd> for new card</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex bg-[#13172a] border border-white/5 rounded-xl p-0.5">
            <button
              onClick={function() { setView('kanban'); }}
              className={'flex items-center gap-1 px-2.5 h-9 text-xs font-semibold rounded-lg transition-all ' + (view === 'kanban' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80')}
              title="Kanban view"
            >
              <Icon name="view_kanban" className="text-base" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={function() { setView('list'); }}
              className={'flex items-center gap-1 px-2.5 h-9 text-xs font-semibold rounded-lg transition-all ' + (view === 'list' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80')}
              title="List view"
            >
              <Icon name="view_list" className="text-base" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
          <TemplatesMenu
            templates={templates}
            onCreate={handleCreateFromTemplate}
            onDelete={handleDeleteTemplate}
          />
          <button
            onClick={function() { handleAddCard('ideas'); }}
            className="flex items-center gap-2 px-3 sm:px-4 h-10 rounded-xl bg-gradient-to-r from-[#5BA3DB] to-[#4a92ca] hover:from-[#6BB3EB] hover:to-[#5BA3DB] text-white text-sm font-semibold transition-all shadow-lg shadow-[#5BA3DB]/10"
          >
            <Icon name="add" className="text-base" />
            <span className="hidden sm:inline">New card</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      <BTPatchBanner cards={cards} />

      <PatchWarRoom cards={cards} onCreate={handlePatchTemplateCreate} />

      <BoardStats cards={cards} />

      <BottleneckHeatmap cards={cards} />

      <CrewWorkload cards={cards} onSelect={function(name) { setFilterAssignee(name === filterAssignee ? '' : name); }} />

      <div className="mb-5">
        <CrewFilterStrip value={filterAssignee} counts={crewCounts} onChange={setFilterAssignee} />
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-[#13172a]/40 border border-dashed border-white/10 rounded-2xl">
          <Icon name="dashboard_customize" className="text-5xl text-white/20 mb-3" />
          <p className="text-white/60 text-sm font-semibold mb-1">No content cards yet</p>
          <p className="text-white/30 text-xs mb-5">Drop your first TFT content idea in to get started</p>
          <button
            onClick={function() { handleAddCard('ideas'); }}
            className="px-5 py-2 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] text-white text-sm font-semibold transition-colors"
          >
            Add first card
          </button>
        </div>
      ) : view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2">
          {COLUMNS.map(function(col) {
            var colCards = visibleCards.filter(function(c) { return c.column_id === col.id; });
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
      ) : (
        <BoardListView
          columns={COLUMNS}
          cards={visibleCards}
          onAddCard={handleAddCard}
          onEditCard={handleEditCard}
          onMoveCard={handleMoveCard}
        />
      )}

      {modal && (
        <CardModal
          initial={modal.initial}
          isEdit={modal.isEdit}
          cardId={modal.isEdit && modal.initial ? modal.initial.id : null}
          onSave={handleSave}
          onSaveAsTemplate={handleSaveAsTemplate}
          onClose={function() { setModal(null); }}
          onDelete={modal.isEdit ? handleDelete : null}
        />
      )}

      <IdeaCaptureFAB onCapture={handleQuickCapture} />
    </div>
  );
}

export default BTBoard;
