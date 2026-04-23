import React from 'react';
import { supabase } from '../../lib/supabase';
import { CHAMPIONS } from '../../lib/btset17';

var COST_COLORS = {
  1: '#9CA3AF',
  2: '#10B981',
  3: '#3B82F6',
  4: '#A855F7',
  5: '#F59E0B',
};

var TIERS = [
  { id: 'S', label: 'S', color: '#FFD700', bg: 'rgba(255,215,0,0.10)' },
  { id: 'A', label: 'A', color: '#FF6B6B', bg: 'rgba(255,107,107,0.10)' },
  { id: 'B', label: 'B', color: '#4ECDC4', bg: 'rgba(78,205,196,0.10)' },
  { id: 'C', label: 'C', color: '#95E1D3', bg: 'rgba(149,225,211,0.10)' },
  { id: 'D', label: 'D', color: '#A8A8A8', bg: 'rgba(168,168,168,0.10)' },
];

function emptyTiers() {
  return { S: [], A: [], B: [], C: [], D: [] };
}

function Icon(props) {
  return (
    <span className={'material-symbols-outlined ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

function ChampChip(props) {
  var champ = props.champ;
  var color = COST_COLORS[champ.cost] || '#9CA3AF';
  var selected = !!props.selected;

  function handleDragStart(e) {
    e.dataTransfer.setData('champName', champ.name);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleClick() {
    if (props.locked) return;
    if (props.onTap) props.onTap(champ.name);
  }

  return (
    <div
      draggable={!props.locked}
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={'px-2.5 py-1.5 rounded-lg text-xs font-semibold select-none transition-all inline-flex items-center gap-1 ' + (props.locked ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95') + (selected ? ' ring-2 ring-[#FFD700] shadow-lg' : '')}
      style={{
        backgroundColor: selected ? color + '40' : color + '20',
        border: '1.5px solid ' + (selected ? '#FFD700' : color),
        color: selected ? '#FFD700' : color,
      }}
      title={props.locked ? champ.cost + '-cost' : 'Tap to select, then tap a tier'}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: selected ? '#FFD700' : color }}
      />
      {champ.name}
    </div>
  );
}

function TierRow(props) {
  var tier = props.tier;
  var champs = props.champs;
  var [dragOver, setDragOver] = React.useState(false);
  var armed = !!props.armed;

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }
  function handleDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
  }
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    var name = e.dataTransfer.getData('champName');
    if (name && props.onDrop) props.onDrop(name, tier.id);
  }
  function handleTapZone() {
    if (armed && props.onTapTier) props.onTapTier(tier.id);
  }

  return (
    <div
      className={'flex items-stretch rounded-xl overflow-hidden mb-2 transition-all ' + (armed ? 'ring-2 ring-[#FFD700]/40' : '')}
      style={{ backgroundColor: tier.bg }}
    >
      <div
        className="w-12 sm:w-16 shrink-0 flex items-center justify-center font-bold text-2xl sm:text-3xl"
        style={{ color: tier.color, fontFamily: 'Russo One, sans-serif' }}
      >
        {tier.label}
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleTapZone}
        className={'flex-1 p-2 sm:p-3 flex flex-wrap gap-1.5 sm:gap-2 min-h-[64px] border-l-2 transition-all ' + (dragOver || armed ? 'bg-white/5' : '') + (armed ? ' cursor-pointer' : '')}
        style={{ borderLeftColor: tier.color + '40' }}
      >
        {champs.length === 0 ? (
          <span className="text-white/20 text-xs italic self-center">
            {props.readOnly ? '' : (armed ? 'Tap to place here' : 'Drop or tap to place')}
          </span>
        ) : (
          champs.map(function(name) {
            var champ = CHAMPIONS.find(function(c) { return c.name === name; }) || { name: name, cost: 1 };
            return (
              <ChampChip
                key={name}
                champ={champ}
                locked={props.readOnly}
                selected={props.selectedChamp === name}
                onTap={props.onTapChamp}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function TierListEditor(props) {
  var initial = props.list || {};
  var [title, setTitle] = React.useState(initial.title || '');
  var [patchLabel, setPatchLabel] = React.useState(initial.patch_label || '');
  var [tiers, setTiers] = React.useState(initial.tiers || emptyTiers());
  var [notes, setNotes] = React.useState(initial.notes || '');
  var [search, setSearch] = React.useState('');
  var [costFilter, setCostFilter] = React.useState(0);
  var [presenting, setPresenting] = React.useState(false);
  var [saving, setSaving] = React.useState(false);
  var [customChamp, setCustomChamp] = React.useState('');
  var [selectedChamp, setSelectedChamp] = React.useState(null);

  function moveChamp(name, toTier) {
    var next = {};
    for (var k in tiers) {
      next[k] = tiers[k].filter(function(n) { return n !== name; });
    }
    if (toTier !== 'pool') {
      next[toTier] = (next[toTier] || []).concat([name]);
    }
    setTiers(next);
  }

  function handleTapChamp(name) {
    setSelectedChamp(function(prev) {
      if (prev === name) {
        // Tap selected champ in tier returns to pool
        var inTier = false;
        for (var k in tiers) { if (tiers[k].indexOf(name) !== -1) { inTier = true; break; } }
        if (inTier) moveChamp(name, 'pool');
        return null;
      }
      return name;
    });
  }

  function handleTapTier(tierId) {
    if (!selectedChamp) return;
    moveChamp(selectedChamp, tierId);
    setSelectedChamp(null);
  }

  function poolDragOver(e) {
    e.preventDefault();
  }
  function poolDrop(e) {
    e.preventDefault();
    var name = e.dataTransfer.getData('champName');
    if (name) moveChamp(name, 'pool');
  }

  function handleAddCustom() {
    var name = customChamp.trim();
    if (!name) return;
    if (CHAMPIONS.some(function(c) { return c.name === name; })) {
      setCustomChamp('');
      return;
    }
    CHAMPIONS.push({ name: name, cost: 1 });
    setCustomChamp('');
  }

  function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    var payload = {
      title: title.trim(),
      tiers: tiers,
      patch_label: patchLabel || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };
    var op;
    if (initial.id) {
      op = supabase.from('bt_tier_lists').update(payload).eq('id', initial.id);
    } else {
      op = supabase.from('bt_tier_lists').insert(payload);
    }
    op.then(function(res) {
      if (res.error) {
        console.error('tier list save failed', res.error);
        setSaving(false);
        return;
      }
      setSaving(false);
      props.onSaved();
    });
  }

  var placed = {};
  for (var k in tiers) {
    tiers[k].forEach(function(n) { placed[n] = true; });
  }
  var availableChamps = CHAMPIONS.filter(function(c) {
    if (placed[c.name]) return false;
    if (costFilter && c.cost !== costFilter) return false;
    if (search.trim() && c.name.toLowerCase().indexOf(search.toLowerCase()) === -1) return false;
    return true;
  });

  if (presenting) {
    return (
      <div className="fixed inset-0 bg-[#0b0e1a] z-50 flex flex-col items-center justify-start p-8 overflow-auto">
        <button
          type="button"
          onClick={function() { setPresenting(false); }}
          className="absolute top-4 right-4 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm flex items-center gap-2 transition-colors"
        >
          <Icon name="close" className="text-base" />
          Exit presentation
        </button>
        <div className="w-full max-w-5xl my-auto">
          <div
            className="rounded-3xl p-8"
            style={{ background: 'radial-gradient(ellipse at top right, rgba(91,163,219,0.15), transparent 60%), radial-gradient(ellipse at bottom left, rgba(232,160,32,0.10), transparent 60%), #0d1120' }}
          >
            <div className="flex items-center gap-4 mb-6">
              <img src="/btlogo.png" alt="BT" className="h-14" style={{ filter: 'drop-shadow(0 4px 12px rgba(91,163,219,0.4))' }} />
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl text-white font-bold tracking-tight" style={{ fontFamily: 'Russo One, sans-serif' }}>
                  {title || 'Tier List'}
                </h1>
                {patchLabel && (
                  <p className="text-[#E8A020] text-sm font-semibold tracking-widest uppercase">{patchLabel}</p>
                )}
              </div>
              <p className="text-white/30 text-xs tracking-widest uppercase">BrosephTech</p>
            </div>
            <div>
              {TIERS.map(function(t) {
                return <TierRow key={t.id} tier={t} champs={tiers[t.id] || []} readOnly />;
              })}
            </div>
            {notes && (
              <p className="mt-6 text-white/60 text-sm italic text-center">{notes}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="md:col-span-2">
          <input
            type="text"
            value={title}
            onChange={function(e) { setTitle(e.target.value); }}
            placeholder="Tier list title (e.g. Patch 17.3 4-cost carries)"
            className="w-full bg-[#0b0e1a] border border-white/10 rounded-xl px-4 py-3 text-white text-base font-semibold focus:outline-none focus:border-[#5BA3DB] transition-colors"
            autoFocus
          />
        </div>
        <input
          type="text"
          value={patchLabel}
          onChange={function(e) { setPatchLabel(e.target.value); }}
          placeholder="Patch / set label"
          className="w-full bg-[#0b0e1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#E8A020] transition-colors"
        />
      </div>

      {selectedChamp ? (
        <div className="mb-3 px-3 py-2 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-between gap-2 sm:hidden">
          <span className="text-xs text-[#FFD700] font-semibold flex items-center gap-1.5">
            <Icon name="touch_app" className="text-base" />
            <span className="font-bold">{selectedChamp}</span> selected - tap a tier
          </span>
          <button
            type="button"
            onClick={function() { setSelectedChamp(null); }}
            className="text-[#FFD700]/70 hover:text-[#FFD700] text-xs font-semibold px-2 py-1 rounded-lg active:bg-[#FFD700]/10"
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="mb-5">
        {TIERS.map(function(t) {
          return (
            <TierRow
              key={t.id}
              tier={t}
              champs={tiers[t.id] || []}
              onDrop={moveChamp}
              armed={!!selectedChamp}
              onTapTier={handleTapTier}
              selectedChamp={selectedChamp}
              onTapChamp={handleTapChamp}
            />
          );
        })}
      </div>

      <div className="bg-[#13172a]/40 border border-white/5 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="text-white text-sm font-semibold flex items-center gap-2">
            <Icon name="grid_view" className="text-[#5BA3DB] text-base" />
            Available champions
            <span className="text-white/30 text-xs font-normal">({availableChamps.length})</span>
          </h3>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={function(e) { setSearch(e.target.value); }}
              placeholder="Search..."
              className="bg-[#0b0e1a] border border-white/10 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-[#5BA3DB] transition-colors w-32"
            />
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map(function(c) {
                var color = c === 0 ? '#9CA3AF' : COST_COLORS[c];
                var active = costFilter === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={function() { setCostFilter(c); }}
                    className={'w-7 h-7 rounded-lg text-xs font-bold transition-all ' + (active ? 'scale-110' : 'opacity-50 hover:opacity-100')}
                    style={{
                      backgroundColor: active ? color + '30' : 'rgba(255,255,255,0.03)',
                      color: color,
                      border: '1px solid ' + (active ? color : 'transparent'),
                    }}
                  >
                    {c === 0 ? 'All' : c}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          onDragOver={poolDragOver}
          onDrop={poolDrop}
          className="flex flex-wrap gap-2 min-h-[120px] p-2 rounded-lg border-2 border-dashed border-white/5"
        >
          {availableChamps.length === 0 ? (
            <p className="text-white/30 text-xs italic self-center">No champions match the filter</p>
          ) : (
            availableChamps.map(function(c) {
              return (
                <ChampChip
                  key={c.name}
                  champ={c}
                  selected={selectedChamp === c.name}
                  onTap={handleTapChamp}
                />
              );
            })
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={customChamp}
            onChange={function(e) { setCustomChamp(e.target.value); }}
            onKeyDown={function(e) { if (e.key === 'Enter') { e.preventDefault(); handleAddCustom(); } }}
            placeholder="Add custom unit..."
            className="flex-1 bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#5BA3DB] transition-colors"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs font-semibold transition-colors flex items-center gap-1"
          >
            <Icon name="add" className="text-sm" />
            Add
          </button>
        </div>
      </div>

      <div className="mb-5">
        <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Notes</label>
        <textarea
          value={notes}
          onChange={function(e) { setNotes(e.target.value); }}
          rows={2}
          placeholder="Why these picks? What changed? Caveats..."
          className="w-full bg-[#0b0e1a] border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB] resize-none transition-colors"
        />
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] disabled:opacity-40 text-white font-semibold text-sm transition-colors"
        >
          <Icon name={saving ? 'progress_activity' : 'save'} className={'text-base ' + (saving ? 'animate-spin' : '')} />
          {saving ? 'Saving' : 'Save tier list'}
        </button>
        <button
          type="button"
          onClick={function() { setPresenting(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E8A020]/10 hover:bg-[#E8A020]/20 text-[#E8A020] font-semibold text-sm transition-colors"
        >
          <Icon name="present_to_all" className="text-base" />
          Presentation mode
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="px-5 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/25 text-sm transition-colors"
        >
          Cancel
        </button>
        {initial.id && (
          <button
            type="button"
            onClick={function() { props.onDelete(initial.id); }}
            className="ml-auto flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors"
          >
            <Icon name="delete" className="text-base" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function TierListCard(props) {
  var l = props.list;
  var totalChamps = 0;
  for (var k in (l.tiers || {})) totalChamps += (l.tiers[k] || []).length;
  var dateStr = new Date(l.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <button
      type="button"
      onClick={function() { props.onOpen(l); }}
      className="text-left bg-[#13172a] border border-white/5 hover:border-white/15 rounded-2xl p-5 transition-all"
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <h3 className="text-white font-bold text-lg leading-tight flex-1" style={{ fontFamily: 'Russo One, sans-serif' }}>{l.title}</h3>
        {l.patch_label && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#E8A020]/15 text-[#E8A020] font-semibold uppercase tracking-wider shrink-0">{l.patch_label}</span>
        )}
      </div>
      <div className="flex flex-col gap-1 mb-3">
        {TIERS.map(function(t) {
          var champs = (l.tiers || {})[t.id] || [];
          return (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <span className="w-5 text-center font-bold shrink-0" style={{ color: t.color }}>{t.label}</span>
              <span className="text-white/60 truncate flex-1">
                {champs.length === 0 ? <span className="text-white/20">empty</span> : champs.join(' · ')}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-white/30">
        <span>{totalChamps} champion{totalChamps === 1 ? '' : 's'} placed</span>
        <span>{dateStr}</span>
      </div>
    </button>
  );
}

function BTTierLists() {
  var [lists, setLists] = React.useState([]);
  var [loading, setLoading] = React.useState(true);
  var [editing, setEditing] = React.useState(null);

  React.useEffect(function() {
    loadLists();
  }, []);

  function loadLists() {
    setLoading(true);
    supabase
      .from('bt_tier_lists')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(function(res) {
        if (res.error) {
          console.error('bt_tier_lists load failed', res.error);
          setLoading(false);
          return;
        }
        setLists(res.data || []);
        setLoading(false);
      });
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this tier list?')) return;
    supabase
      .from('bt_tier_lists')
      .delete()
      .eq('id', id)
      .then(function(res) {
        if (res.error) {
          console.error('tier list delete failed', res.error);
          return;
        }
        setEditing(null);
        loadLists();
      });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/30">
        <Icon name="progress_activity" className="animate-spin text-3xl mr-3" />
        Loading tier lists...
      </div>
    );
  }

  if (editing) {
    return (
      <TierListEditor
        list={editing.id ? editing : null}
        onSaved={function() { setEditing(null); loadLists(); }}
        onCancel={function() { setEditing(null); }}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>Tier Lists</h2>
          <p className="text-sm text-white/40 mt-0.5">{lists.length} saved · branded for screenshots and thumbnails</p>
        </div>
        <button
          type="button"
          onClick={function() { setEditing({}); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#5BA3DB] to-[#4a92ca] hover:from-[#6BB3EB] hover:to-[#5BA3DB] text-white text-sm font-semibold transition-all shadow-lg shadow-[#5BA3DB]/10"
        >
          <Icon name="add" className="text-base" />
          New tier list
        </button>
      </div>

      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-[#13172a]/40 border border-dashed border-white/10 rounded-2xl">
          <Icon name="leaderboard" className="text-5xl text-white/20 mb-3" />
          <p className="text-white/60 text-sm font-semibold mb-1">No tier lists yet</p>
          <p className="text-white/30 text-xs mb-5">Build one for thumbnails or in-video graphics</p>
          <button
            type="button"
            onClick={function() { setEditing({}); }}
            className="px-5 py-2 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] text-white text-sm font-semibold transition-colors"
          >
            Build first list
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lists.map(function(l) {
            return <TierListCard key={l.id} list={l} onOpen={setEditing} />;
          })}
        </div>
      )}
    </div>
  );
}

export default BTTierLists;
