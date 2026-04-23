import React from 'react';
import { supabase } from '../../lib/supabase';
import BTPatchBanner from './BTPatchBanner';
import { MECHANIC_TERMS } from '../../lib/btset17';
import useBTSync from './useBTSync';

var BOARD_TABLES = ['bt_content_cards'];

var COLUMNS = [
  { id: 'ideas',      label: 'Ideas',      icon: 'lightbulb',    color: '#A78BFA', accent: 'rgba(167,139,250,0.15)' },
  { id: 'writing',    label: 'Writing',    icon: 'edit_note',    color: '#5BA3DB', accent: 'rgba(91,163,219,0.15)' },
  { id: 'production', label: 'Production', icon: 'movie',        color: '#E8A020', accent: 'rgba(232,160,32,0.15)' },
  { id: 'review',     label: 'Review',     icon: 'visibility',   color: '#EC4899', accent: 'rgba(236,72,153,0.15)' },
  { id: 'published',  label: 'Published',  icon: 'check_circle', color: '#10B981', accent: 'rgba(16,185,129,0.15)' },
  { id: 'archive',    label: 'Archive',    icon: 'archive',      color: '#6B7280', accent: 'rgba(107,114,128,0.15)' },
];

var TEAM = ['Levitate', 'Co-Founder', 'Founder 3', 'Scriptwriter', 'Editor', 'GFX'];

var TEAM_COLORS = {
  'Levitate': '#5BA3DB',
  'Co-Founder': '#E8A020',
  'Founder 3': '#A78BFA',
  'Scriptwriter': '#EC4899',
  'Editor': '#10B981',
  'GFX': '#F59E0B',
};

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
  priority: 'medium',
  due_date: '',
  patch_id: '',
  brief: null,
};

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
  var name = props.name || '';
  if (!name) return null;
  var initial = name.charAt(0).toUpperCase();
  var bg = TEAM_COLORS[name] || '#6B7280';
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
      style={{
        width: props.size || 20,
        height: props.size || 20,
        backgroundColor: bg,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
      }}
      title={name}
    >
      {initial}
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
          <p className="text-[11px] text-white/25 italic px-1">No {props.singular || 'items'} yet</p>
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
        <p className="text-[11px] text-white/30 italic text-center py-3">Add 3-5 variants to compare</p>
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Assignee</label>
          <Sel value={form.assignee} onChange={function(e) { set('assignee', e.target.value); }}>
            <option value="">Unassigned</option>
            {TEAM.map(function(m) {
              return <option key={m} value={m}>{m}</option>;
            })}
          </Sel>
        </div>
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Due date</label>
          <Inp
            type="date"
            value={form.due_date || ''}
            onChange={function(e) { set('due_date', e.target.value); }}
          />
        </div>
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

        <div className="px-6 flex gap-1 border-b border-white/5">
          <button
            type="button"
            onClick={function() { setTab('card'); }}
            className={'flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-all ' + (tab === 'card' ? 'border-[#5BA3DB] text-[#5BA3DB]' : 'border-transparent text-white/40 hover:text-white/80')}
          >
            <Icon name="dashboard_customize" className="text-base" />
            Card
          </button>
          <button
            type="button"
            onClick={function() { setTab('brief'); ensureBrief(); }}
            className={'flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-all ' + (tab === 'brief' ? 'border-[#E8A020] text-[#E8A020]' : 'border-transparent text-white/40 hover:text-white/80')}
          >
            <Icon name="auto_stories" className="text-base" />
            Brief & Title
            {briefHasContent && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8A020]" title="Brief has content" />
            )}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === 'card' ? (
              <CardFields form={form} set={set} isEdit={props.isEdit} />
            ) : (
              <BriefForm
                brief={form.brief || EMPTY_BRIEF}
                cardTitle={form.title}
                onChange={setBrief}
                onPickTitle={handlePickTitle}
              />
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-white/5 bg-[#0f1320]/40 rounded-b-2xl">
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
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
            {props.onDelete && (
              <button
                type="button"
                onClick={props.onDelete}
                className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors flex items-center gap-1.5"
              >
                <Icon name="delete" className="text-base" />
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
        {card.assignee && <TeamAvatar name={card.assignee} />}
      </div>

      {card.due_date && (
        <div className={'flex items-center gap-1 mt-2 text-[10px] ' + (overdue ? 'text-red-400' : 'text-white/30')}>
          <Icon name="calendar_today" className="text-[11px]" />
          {new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          {overdue && <span className="ml-1 font-semibold">OVERDUE</span>}
        </div>
      )}
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
        <p className="text-white text-sm font-medium leading-snug truncate">{card.title || 'Untitled'}</p>
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
          {card.due_date && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide bg-white/5 text-white/40 flex items-center gap-0.5">
              <Icon name="calendar_today" className="text-[10px]" />
              {new Date(card.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
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

function BTBoard() {
  var [cards, setCards] = React.useState([]);
  var [loading, setLoading] = React.useState(true);
  var [modal, setModal] = React.useState(null);
  var [filterAssignee, setFilterAssignee] = React.useState('');
  var [view, setView] = React.useState(function() {
    if (typeof window === 'undefined') return 'kanban';
    return window.innerWidth < 640 ? 'list' : 'kanban';
  });

  React.useEffect(function() {
    loadCards();
  }, []);

  useBTSync(BOARD_TABLES, function() { loadCards(); });

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

  function handleAddCard(columnId) {
    setModal({ initial: Object.assign({}, EMPTY_FORM, { column_id: columnId || 'ideas' }), isEdit: false });
  }

  function handleEditCard(card) {
    setModal({ initial: card, isEdit: true });
  }

  function handleSave(form, done) {
    var payload = {
      title: form.title,
      description: form.description,
      column_id: form.column_id,
      content_type: form.content_type,
      platform: form.platform,
      assignee: form.assignee,
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

  var visibleCards = filterAssignee ? cards.filter(function(c) { return c.assignee === filterAssignee; }) : cards;

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>Content Board</h2>
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
          <Sel value={filterAssignee} onChange={function(e) { setFilterAssignee(e.target.value); }}>
            <option value="">All team</option>
            {TEAM.map(function(m) {
              return <option key={m} value={m}>{m}</option>;
            })}
          </Sel>
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

      <BoardStats cards={cards} />

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
          onSave={handleSave}
          onClose={function() { setModal(null); }}
          onDelete={modal.isEdit ? handleDelete : null}
        />
      )}
    </div>
  );
}

export default BTBoard;
