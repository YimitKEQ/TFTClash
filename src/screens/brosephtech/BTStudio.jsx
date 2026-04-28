import React from 'react';
import { supabase } from '../../lib/supabase';
import useBTSync from './useBTSync';

var STUDIO_TABLES = ['bt_hooks', 'bt_ideas', 'bt_content_cards'];

var CATEGORIES = [
  { id: 'all',         label: 'All hooks',     color: '#5BA3DB' },
  { id: 'curiosity',   label: 'Curiosity',     color: '#A78BFA' },
  { id: 'contrarian',  label: 'Contrarian',    color: '#EC4899' },
  { id: 'list',        label: 'List',          color: '#5BA3DB' },
  { id: 'question',    label: 'Question',      color: '#10B981' },
  { id: 'urgency',     label: 'Urgency',       color: '#EF4444' },
  { id: 'tier',        label: 'Tier',          color: '#E8A020' },
  { id: 'underrated',  label: 'Underrated',    color: '#06B6D4' },
  { id: 'patch_react', label: 'Patch react',   color: '#F59E0B' },
  { id: 'comparison',  label: 'Comparison',    color: '#8B5CF6' },
  { id: 'mistake',     label: 'Mistake',       color: '#F87171' },
  { id: 'pro',         label: 'Pro tips',      color: '#3B82F6' },
  { id: 'beginner',    label: 'Beginner',      color: '#34D399' },
  { id: 'set_release', label: 'Set release',   color: '#E8A020' },
  { id: 'augment',     label: 'Augment',       color: '#A78BFA' },
  { id: 'comp',        label: 'Comp guide',    color: '#5BA3DB' },
  { id: 'react',       label: 'React',         color: '#EC4899' },
  { id: 'challenge',   label: 'Challenge',     color: '#F59E0B' },
  { id: 'vod',         label: 'VOD review',    color: '#10B981' },
  { id: 'shorts_hook', label: 'Shorts hook',   color: '#FF0000' },
  { id: 'community',   label: 'Community',     color: '#06B6D4' },
];

function Icon(props) {
  return (
    <span className={'material-symbols-outlined ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

function HookCard(props) {
  var hook = props.hook;
  var [copied, setCopied] = React.useState(false);
  var cat = CATEGORIES.find(function(c) { return c.id === hook.category; }) || CATEGORIES[0];

  function handleCopy() {
    navigator.clipboard.writeText(hook.template);
    setCopied(true);
    setTimeout(function() { setCopied(false); }, 1500);
  }

  return (
    <div className="bg-[#0b0e1a] border border-white/5 rounded-xl p-3.5 hover:border-white/15 transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider"
          style={{ backgroundColor: cat.color + '20', color: cat.color }}
        >
          {cat.label}
        </span>
        <span className="text-[10px] text-white/30">{hook.use_count || 0}x used</span>
      </div>
      <p className="text-white text-sm font-medium leading-snug mb-2">{hook.template}</p>
      {hook.example && (
        <p className="text-white/40 text-xs mb-3">e.g. "{hook.example}"</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors"
        >
          <Icon name={copied ? 'check' : 'content_copy'} className="text-sm" />
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={function() { props.onUse(hook); }}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#5BA3DB]/10 hover:bg-[#5BA3DB]/20 text-[#5BA3DB] text-xs transition-colors"
        >
          <Icon name="add" className="text-sm" />
          To inbox
        </button>
      </div>
    </div>
  );
}

function IdeaItem(props) {
  var idea = props.idea;
  var dateStr = new Date(idea.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="bg-[#0b0e1a] border border-white/5 rounded-xl p-3 flex items-start justify-between gap-3 group hover:border-white/15 transition-all">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm leading-snug">{idea.text}</p>
        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/30 flex-wrap">
          <Icon name="schedule" className="text-[11px]" />
          <span>{dateStr}</span>
          {idea.added_by && (
            <span className="flex items-center gap-1">
              <span className="text-white/15">·</span>
              <span>{idea.added_by}</span>
            </span>
          )}
          {idea.source && (
            <span className="px-1.5 py-0.5 rounded bg-white/5">{idea.source}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={function() { props.onConvert(idea); }}
          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
          title="Convert to card"
        >
          <Icon name="arrow_forward" className="text-base" />
        </button>
        <button
          type="button"
          onClick={function() { props.onDelete(idea); }}
          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
          title="Delete"
        >
          <Icon name="delete" className="text-base" />
        </button>
      </div>
    </div>
  );
}

function BTStudio() {
  var [hooks, setHooks] = React.useState([]);
  var [ideas, setIdeas] = React.useState([]);
  var [loading, setLoading] = React.useState(true);
  var [filter, setFilter] = React.useState('all');
  var [search, setSearch] = React.useState('');
  var [newIdea, setNewIdea] = React.useState('');
  var [savingIdea, setSavingIdea] = React.useState(false);
  var [toast, setToast] = React.useState('');
  var ideaInputRef = React.useRef(null);

  React.useEffect(function() {
    loadAll();
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        if (ideaInputRef.current) ideaInputRef.current.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, []);

  useBTSync(STUDIO_TABLES, function() { loadAll(); });

  function flashToast(msg) {
    setToast(msg);
    setTimeout(function() { setToast(''); }, 1800);
  }

  function loadAll() {
    Promise.all([
      supabase.from('bt_hooks').select('*').order('use_count', { ascending: false }),
      supabase.from('bt_ideas').select('*').eq('status', 'inbox').order('created_at', { ascending: false }),
    ]).then(function(results) {
      var hookRes = results[0];
      var ideaRes = results[1];
      if (hookRes.error) console.error('bt_hooks load failed', hookRes.error);
      if (ideaRes.error) console.error('bt_ideas load failed', ideaRes.error);
      setHooks(hookRes.data || []);
      setIdeas(ideaRes.data || []);
      setLoading(false);
    });
  }

  function handleSubmitIdea(e) {
    e.preventDefault();
    var text = newIdea.trim();
    if (!text) return;
    setSavingIdea(true);
    supabase
      .from('bt_ideas')
      .insert({ text: text, source: 'manual' })
      .then(function(res) {
        if (res.error) {
          console.error('bt_ideas insert failed', res.error);
          setSavingIdea(false);
          return;
        }
        setNewIdea('');
        setSavingIdea(false);
        loadAll();
        flashToast('Idea captured');
      });
  }

  function handleUseHook(hook) {
    supabase
      .from('bt_ideas')
      .insert({ text: hook.template, source: 'hook' })
      .then(function(res) {
        if (res.error) {
          console.error('hook to idea failed', res.error);
          return;
        }
        supabase
          .from('bt_hooks')
          .update({ use_count: (hook.use_count || 0) + 1 })
          .eq('id', hook.id)
          .then(function() {
            loadAll();
            flashToast('Hook copied to inbox');
          });
      });
  }

  function handleConvertIdea(idea) {
    supabase
      .from('bt_content_cards')
      .insert({
        title: idea.text,
        column_id: 'ideas',
        content_type: 'short',
        platform: 'both',
        priority: 'medium',
      })
      .then(function(res) {
        if (res.error) {
          console.error('idea to card failed', res.error);
          return;
        }
        supabase
          .from('bt_ideas')
          .update({ status: 'used' })
          .eq('id', idea.id)
          .then(function() {
            loadAll();
            flashToast('Sent to Content Board');
          });
      });
  }

  function handleDeleteIdea(idea) {
    supabase
      .from('bt_ideas')
      .delete()
      .eq('id', idea.id)
      .then(function(res) {
        if (res.error) {
          console.error('idea delete failed', res.error);
          return;
        }
        loadAll();
      });
  }

  var filteredHooks = hooks.filter(function(h) {
    if (filter !== 'all' && h.category !== filter) return false;
    if (search.trim()) {
      var s = search.toLowerCase();
      var inTpl = h.template.toLowerCase().indexOf(s) !== -1;
      var inEx = h.example && h.example.toLowerCase().indexOf(s) !== -1;
      if (!inTpl && !inEx) return false;
    }
    return true;
  });

  var topUsed = hooks
    .slice()
    .filter(function(h) { return (h.use_count || 0) > 0; })
    .sort(function(a, b) { return (b.use_count || 0) - (a.use_count || 0); })
    .slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/30">
        <Icon name="progress_activity" className="animate-spin text-3xl mr-3" />
        Loading studio...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Subtle, system-ui, sans-serif' }}>Studio</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {hooks.length} hooks · {ideas.length} in inbox
            <span className="ml-3 text-[11px] text-white/25">
              Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-white/40">Ctrl I</kbd> to capture
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="psychology" className="text-[#5BA3DB] text-xl" />
            <h3 className="text-white font-semibold">Hook Bank</h3>
          </div>

          <input
            type="text"
            value={search}
            onChange={function(e) { setSearch(e.target.value); }}
            placeholder="Search hooks and examples..."
            className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB] transition-colors mb-3"
          />

          <div className="flex gap-1.5 mb-4 flex-wrap">
            {CATEGORIES.map(function(cat) {
              var active = filter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={function() { setFilter(cat.id); }}
                  className={'text-[11px] px-2.5 py-1 rounded-lg font-semibold uppercase tracking-wider transition-all ' + (active ? '' : 'text-white/40 hover:text-white/70')}
                  style={active ? { backgroundColor: cat.color + '30', color: cat.color } : { backgroundColor: 'rgba(255,255,255,0.03)' }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {filteredHooks.length === 0 ? (
            <div className="text-center text-white/30 py-12 text-sm">No hooks match your filters</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredHooks.map(function(h) {
                return <HookCard key={h.id} hook={h} onUse={handleUseHook} />;
              })}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="inbox" className="text-[#E8A020] text-xl" />
            <h3 className="text-white font-semibold">Idea Inbox</h3>
          </div>

          <form onSubmit={handleSubmitIdea} className="mb-4">
            <div className="flex gap-2">
              <input
                ref={ideaInputRef}
                type="text"
                value={newIdea}
                onChange={function(e) { setNewIdea(e.target.value); }}
                placeholder="Drop an idea fast..."
                className="flex-1 bg-[#0b0e1a] border border-[#E8A020]/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E8A020] transition-colors"
              />
              <button
                type="submit"
                disabled={savingIdea || !newIdea.trim()}
                className="px-3 py-2 rounded-lg bg-[#E8A020] hover:bg-[#F8B030] disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center"
              >
                <Icon name="add" className="text-base" />
              </button>
            </div>
            <p className="text-[10px] text-white/30 mt-1.5">
              Captures stay here until you convert them to cards
            </p>
          </form>

          {ideas.length === 0 ? (
            <div className="bg-[#13172a]/40 border border-dashed border-white/10 rounded-xl p-6 text-center">
              <Icon name="lightbulb" className="text-3xl text-white/20 mb-2 block mx-auto" />
              <p className="text-white/50 text-xs">Inbox is empty.<br/>Add ideas as they hit you.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {ideas.map(function(idea) {
                return (
                  <IdeaItem
                    key={idea.id}
                    idea={idea}
                    onConvert={handleConvertIdea}
                    onDelete={handleDeleteIdea}
                  />
                );
              })}
            </div>
          )}

          {topUsed.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                <Icon name="local_fire_department" className="text-[#E8A020] text-sm" />
                Most-used hooks
              </p>
              <div className="flex flex-col gap-1.5">
                {topUsed.map(function(h) {
                  return (
                    <div key={h.id} className="flex items-center gap-2 text-xs text-white/50 bg-[#13172a]/40 rounded-lg px-3 py-2">
                      <span className="text-[#E8A020] font-bold tabular-nums shrink-0">{h.use_count || 0}x</span>
                      <span className="truncate">{h.template}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#5BA3DB] text-white text-sm font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in">
          <Icon name="check_circle" className="text-base" />
          {toast}
        </div>
      )}
    </div>
  );
}

export default BTStudio;
