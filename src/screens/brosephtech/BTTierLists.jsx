import React from 'react';
import { supabase } from '../../lib/supabase';
import { BT_CHAMPIONS, BT_ITEM_GROUPS, BT_ITEMS_ALL, getChamp, getItem } from '../../lib/btassets';
import useBTSync from './useBTSync';

var TIERLIST_TABLES = ['bt_tier_lists'];

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

var KINDS = [
  { id: 'champions', label: 'Champions', icon: 'group' },
  { id: 'items', label: 'Items', icon: 'shield' },
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

function initialsSvg(name, cost) {
  var color = COST_COLORS[cost] || '#9CA3AF';
  var letters = String(name || '?').split(/\s+/).map(function(w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    + '<rect width="64" height="64" fill="' + color + '" opacity="0.22"/>'
    + '<rect x="2" y="2" width="60" height="60" fill="none" stroke="' + color + '" stroke-width="2"/>'
    + '<text x="32" y="40" text-anchor="middle" fill="' + color + '" font-family="monospace" font-size="22" font-weight="700">'
    + letters + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function ChampImg(props) {
  var champ = props.champ;
  var size = props.size || 44;
  var assets = (champ && champ.assets) || {};
  var stepRef = React.useRef(0);
  var chain = [assets.hud, assets.square, assets.face_lg, assets.face].filter(function(u) {
    return typeof u === 'string' && u.length > 0;
  });
  var fallback = initialsSvg(champ && champ.name, champ && champ.cost);

  function handleError(e) {
    stepRef.current += 1;
    if (stepRef.current < chain.length) {
      e.target.src = chain[stepRef.current];
      return;
    }
    if (e.target.src !== fallback) e.target.src = fallback;
  }

  return (
    <img
      alt={(champ && champ.name) || 'champion'}
      src={chain[0] || fallback}
      onError={handleError}
      style={{
        width: size,
        height: size,
        objectFit: 'cover',
        display: 'block',
        background: '#0e0d15',
      }}
    />
  );
}

function ChampChip(props) {
  var champ = props.champ;
  var name = (champ && champ.name) || props.name || '?';
  var cost = (champ && champ.cost) || 1;
  var color = COST_COLORS[cost] || '#9CA3AF';
  var selected = !!props.selected;
  var size = props.compact ? 36 : 44;

  function handleDragStart(e) {
    e.dataTransfer.setData('btChip', JSON.stringify({ kind: 'champions', id: name }));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleClick() {
    if (props.locked) return;
    if (props.onTap) props.onTap(name);
  }

  return (
    <div
      draggable={!props.locked}
      onDragStart={handleDragStart}
      onClick={handleClick}
      title={name + ' (' + cost + '-cost)'}
      className={'rounded-lg overflow-hidden select-none transition-all relative inline-block ' + (props.locked ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95')}
      style={{
        border: '2px solid ' + (selected ? '#FFD700' : color),
        boxShadow: selected ? '0 0 0 2px rgba(255,215,0,0.35), 0 4px 12px rgba(255,215,0,0.25)' : 'none',
      }}
    >
      <ChampImg champ={champ || { name: name, cost: cost }} size={size} />
      <span
        className="absolute bottom-0 right-0 px-1 text-[9px] font-bold leading-none rounded-tl"
        style={{ background: color, color: '#0b0e1a' }}
      >
        {cost}
      </span>
      {selected && (
        <span
          className="absolute top-0 left-0 w-2 h-2 rounded-full"
          style={{ background: '#FFD700', boxShadow: '0 0 6px #FFD700' }}
        />
      )}
    </div>
  );
}

function ItemChip(props) {
  var item = props.item;
  var name = (item && item.name) || props.apiName || '?';
  var apiName = (item && item.apiName) || props.apiName;
  var selected = !!props.selected;
  var size = props.compact ? 36 : 44;
  var url = item && item.icon;

  function handleDragStart(e) {
    e.dataTransfer.setData('btChip', JSON.stringify({ kind: 'items', id: apiName }));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleClick() {
    if (props.locked) return;
    if (props.onTap) props.onTap(apiName);
  }

  function handleImgError(e) {
    e.target.style.opacity = '0.25';
  }

  return (
    <div
      draggable={!props.locked}
      onDragStart={handleDragStart}
      onClick={handleClick}
      title={name}
      className={'rounded-lg overflow-hidden select-none transition-all relative inline-block ' + (props.locked ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95')}
      style={{
        border: '2px solid ' + (selected ? '#FFD700' : 'rgba(255,198,107,0.55)'),
        boxShadow: selected ? '0 0 0 2px rgba(255,215,0,0.35), 0 4px 12px rgba(255,215,0,0.25)' : 'none',
        background: '#0e0d15',
      }}
    >
      {url ? (
        <img
          src={url}
          alt={name}
          onError={handleImgError}
          style={{ width: size, height: size, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFC66B',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {name.slice(0, 3)}
        </div>
      )}
      {selected && (
        <span
          className="absolute top-0 left-0 w-2 h-2 rounded-full"
          style={{ background: '#FFD700', boxShadow: '0 0 6px #FFD700' }}
        />
      )}
    </div>
  );
}

function renderChip(kind, id, opts) {
  if (kind === 'items') {
    var item = getItem(id) || { apiName: id, name: id, icon: '' };
    return <ItemChip key={id} item={item} apiName={id} {...opts} />;
  }
  var champ = getChamp(id) || { name: id, cost: 1, assets: {} };
  return <ChampChip key={id} champ={champ} {...opts} />;
}

function TierRow(props) {
  var tier = props.tier;
  var ids = props.ids || [];
  var kind = props.kind || 'champions';
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
    var raw = e.dataTransfer.getData('btChip');
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      if (parsed.kind === kind && props.onDrop) props.onDrop(parsed.id, tier.id);
    } catch (err) { /* ignore */ }
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
        style={{ color: tier.color, fontFamily: 'Subtle, system-ui, sans-serif' }}
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
        {ids.length === 0 ? (
          <span className="text-white/20 text-xs self-center">
            {props.readOnly ? '' : (armed ? 'Tap to place here' : 'Drop or tap to place')}
          </span>
        ) : (
          ids.map(function(id) {
            return renderChip(kind, id, {
              locked: !!props.readOnly,
              selected: props.selectedId === id,
              onTap: props.onTapItem,
              compact: !!props.compact,
            });
          })
        )}
      </div>
    </div>
  );
}

function KindToggle(props) {
  return (
    <div className="inline-flex bg-[#0b0e1a] border border-white/10 rounded-xl p-1 gap-1">
      {KINDS.map(function(k) {
        var active = props.value === k.id;
        return (
          <button
            key={k.id}
            type="button"
            disabled={!!props.disabled}
            onClick={function() { if (!props.disabled) props.onChange(k.id); }}
            className={'px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ' + (active ? 'bg-[#5BA3DB] text-white shadow-md' : 'text-white/50 hover:text-white/80') + (props.disabled ? ' opacity-50 cursor-not-allowed' : '')}
          >
            <Icon name={k.icon} className="text-sm" />
            {k.label}
          </button>
        );
      })}
    </div>
  );
}

function TierListEditor(props) {
  var initial = props.list || {};
  var [title, setTitle] = React.useState(initial.title || '');
  var [patchLabel, setPatchLabel] = React.useState(initial.patch_label || '');
  var [kind, setKind] = React.useState(initial.kind || (initial.tiers && initial.tiers.__kind) || 'champions');
  var [tiers, setTiers] = React.useState(function() {
    var t = initial.tiers || emptyTiers();
    var out = {};
    TIERS.forEach(function(tier) { out[tier.id] = (t[tier.id] || []).slice(); });
    return out;
  });
  var [notes, setNotes] = React.useState(initial.notes || '');
  var [search, setSearch] = React.useState('');
  var [costFilter, setCostFilter] = React.useState(0);
  var [itemGroup, setItemGroup] = React.useState('standard');
  var [presenting, setPresenting] = React.useState(false);
  var [saving, setSaving] = React.useState(false);
  var [selectedId, setSelectedId] = React.useState(null);

  var hasPlacements = false;
  for (var key in tiers) { if ((tiers[key] || []).length > 0) { hasPlacements = true; break; } }
  var kindLocked = hasPlacements && !!initial.id;

  function moveItem(id, toTier) {
    var next = {};
    for (var k in tiers) {
      next[k] = tiers[k].filter(function(n) { return n !== id; });
    }
    if (toTier !== 'pool') {
      next[toTier] = (next[toTier] || []).concat([id]);
    }
    setTiers(next);
  }

  function handleTapItem(id) {
    setSelectedId(function(prev) {
      if (prev === id) {
        var inTier = false;
        for (var k in tiers) { if (tiers[k].indexOf(id) !== -1) { inTier = true; break; } }
        if (inTier) moveItem(id, 'pool');
        return null;
      }
      return id;
    });
  }

  function handleTapTier(tierId) {
    if (!selectedId) return;
    moveItem(selectedId, tierId);
    setSelectedId(null);
  }

  function poolDragOver(e) { e.preventDefault(); }
  function poolDrop(e) {
    e.preventDefault();
    var raw = e.dataTransfer.getData('btChip');
    if (!raw) return;
    try {
      var parsed = JSON.parse(raw);
      if (parsed.kind === kind) moveItem(parsed.id, 'pool');
    } catch (err) { /* ignore */ }
  }

  function handleKindChange(nextKind) {
    if (kind === nextKind) return;
    if (kindLocked) return;
    if (hasPlacements) {
      if (!window.confirm('Switching list kind will clear current placements. Continue?')) return;
      setTiers(emptyTiers());
    }
    setSelectedId(null);
    setKind(nextKind);
  }

  function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    var tiersWithKind = Object.assign({ __kind: kind }, tiers);
    var payload = {
      title: title.trim(),
      tiers: tiersWithKind,
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
  for (var k in tiers) { tiers[k].forEach(function(n) { placed[n] = true; }); }

  var availableItems;
  if (kind === 'items') {
    var sourceList;
    if (itemGroup === 'all') sourceList = BT_ITEMS_ALL;
    else {
      var group = BT_ITEM_GROUPS.find(function(g) { return g.id === itemGroup; });
      sourceList = group ? group.items : [];
    }
    availableItems = sourceList.filter(function(it) {
      if (placed[it.apiName]) return false;
      if (search.trim() && it.name.toLowerCase().indexOf(search.toLowerCase()) === -1) return false;
      return true;
    });
  } else {
    availableItems = BT_CHAMPIONS.filter(function(c) {
      if (placed[c.name]) return false;
      if (costFilter && c.cost !== costFilter) return false;
      if (search.trim() && c.name.toLowerCase().indexOf(search.toLowerCase()) === -1) return false;
      return true;
    });
  }

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
                <h1 className="text-3xl text-white font-bold tracking-tight" style={{ fontFamily: 'Subtle, system-ui, sans-serif' }}>
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
                return <TierRow key={t.id} tier={t} ids={tiers[t.id] || []} kind={kind} readOnly />;
              })}
            </div>
            {notes && (
              <p className="mt-6 text-white/60 text-sm text-center">{notes}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className="md:col-span-2">
          <input
            type="text"
            value={title}
            onChange={function(e) { setTitle(e.target.value); }}
            placeholder={kind === 'items' ? 'Tier list title (e.g. Patch 17.3 best items)' : 'Tier list title (e.g. Patch 17.3 4-cost carries)'}
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

      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <KindToggle value={kind} onChange={handleKindChange} disabled={kindLocked} />
        {kindLocked && (
          <span className="text-[10px] text-white/30">Kind locked once placements exist</span>
        )}
      </div>

      {selectedId ? (
        <div className="mb-3 px-3 py-2 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-between gap-2 sm:hidden">
          <span className="text-xs text-[#FFD700] font-semibold flex items-center gap-1.5">
            <Icon name="touch_app" className="text-base" />
            <span className="font-bold">{kind === 'items' ? (getItem(selectedId) || {}).name || selectedId : selectedId}</span> selected - tap a tier
          </span>
          <button
            type="button"
            onClick={function() { setSelectedId(null); }}
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
              ids={tiers[t.id] || []}
              kind={kind}
              onDrop={moveItem}
              armed={!!selectedId}
              onTapTier={handleTapTier}
              selectedId={selectedId}
              onTapItem={handleTapItem}
            />
          );
        })}
      </div>

      <div className="bg-[#13172a]/40 border border-white/5 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="text-white text-sm font-semibold flex items-center gap-2">
            <Icon name="grid_view" className="text-[#5BA3DB] text-base" />
            Available {kind === 'items' ? 'items' : 'champions'}
            <span className="text-white/30 text-xs font-normal">({availableItems.length})</span>
          </h3>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={function(e) { setSearch(e.target.value); }}
              placeholder="Search..."
              className="bg-[#0b0e1a] border border-white/10 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-[#5BA3DB] transition-colors w-32"
            />
            {kind === 'champions' ? (
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
            ) : (
              <div className="flex gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={function() { setItemGroup('all'); }}
                  className={'px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ' + (itemGroup === 'all' ? 'bg-[#5BA3DB]/30 text-[#5BA3DB] border border-[#5BA3DB]/50' : 'text-white/50 hover:text-white border border-transparent')}
                >
                  All
                </button>
                {BT_ITEM_GROUPS.map(function(g) {
                  var active = itemGroup === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={function() { setItemGroup(g.id); }}
                      className={'px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ' + (active ? 'bg-[#E8A020]/30 text-[#E8A020] border border-[#E8A020]/50' : 'text-white/50 hover:text-white border border-transparent')}
                    >
                      {g.label}
                      <span className="ml-1 text-white/30">{g.items.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div
          onDragOver={poolDragOver}
          onDrop={poolDrop}
          className="flex flex-wrap gap-2 min-h-[120px] p-2 rounded-lg border-2 border-dashed border-white/5"
        >
          {availableItems.length === 0 ? (
            <p className="text-white/30 text-xs self-center">No {kind === 'items' ? 'items' : 'champions'} match the filter</p>
          ) : kind === 'items' ? (
            availableItems.map(function(it) {
              return (
                <ItemChip
                  key={it.apiName}
                  item={it}
                  apiName={it.apiName}
                  selected={selectedId === it.apiName}
                  onTap={handleTapItem}
                />
              );
            })
          ) : (
            availableItems.map(function(c) {
              return (
                <ChampChip
                  key={c.name}
                  champ={c}
                  name={c.name}
                  selected={selectedId === c.name}
                  onTap={handleTapItem}
                />
              );
            })
          )}
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

function listKindOf(l) {
  if (l.kind) return l.kind;
  if (l.tiers && l.tiers.__kind) return l.tiers.__kind;
  return 'champions';
}

function listIdsOf(l, tierId) {
  var arr = (l.tiers || {})[tierId];
  return Array.isArray(arr) ? arr : [];
}

function nameForId(kind, id) {
  if (kind === 'items') {
    var item = getItem(id);
    return item ? item.name : id;
  }
  return id;
}

function TierListCard(props) {
  var l = props.list;
  var kind = listKindOf(l);
  var totalPlaced = 0;
  TIERS.forEach(function(t) { totalPlaced += listIdsOf(l, t.id).length; });
  var dateStr = new Date(l.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <button
      type="button"
      onClick={function() { props.onOpen(l); }}
      className="text-left bg-[#13172a] border border-white/5 hover:border-white/15 rounded-2xl p-5 transition-all"
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-lg leading-tight" style={{ fontFamily: 'Subtle, system-ui, sans-serif' }}>{l.title}</h3>
          <span className="inline-flex items-center gap-1 text-[10px] mt-1 text-white/40 uppercase tracking-wider">
            <Icon name={kind === 'items' ? 'shield' : 'group'} className="text-xs" />
            {kind === 'items' ? 'Items' : 'Champions'}
          </span>
        </div>
        {l.patch_label && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#E8A020]/15 text-[#E8A020] font-semibold uppercase tracking-wider shrink-0">{l.patch_label}</span>
        )}
      </div>
      <div className="flex flex-col gap-1 mb-3">
        {TIERS.map(function(t) {
          var ids = listIdsOf(l, t.id);
          return (
            <div key={t.id} className="flex items-center gap-2 text-xs">
              <span className="w-5 text-center font-bold shrink-0" style={{ color: t.color }}>{t.label}</span>
              <span className="text-white/60 truncate flex-1">
                {ids.length === 0 ? <span className="text-white/20">empty</span> : ids.map(function(id) { return nameForId(kind, id); }).join(' . ')}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-white/30">
        <span>{totalPlaced} {kind === 'items' ? 'item' : 'champion'}{totalPlaced === 1 ? '' : 's'} placed</span>
        <span>{dateStr}</span>
      </div>
    </button>
  );
}

function BTTierLists() {
  var [lists, setLists] = React.useState([]);
  var [loading, setLoading] = React.useState(true);
  var [editing, setEditing] = React.useState(null);

  React.useEffect(function() { loadLists(); }, []);

  useBTSync(TIERLIST_TABLES, function() { loadLists(); });

  function loadLists() {
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
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Subtle, system-ui, sans-serif' }}>Tier Lists</h2>
          <p className="text-sm text-white/40 mt-0.5">{lists.length} saved . champion or item lists, branded for thumbnails</p>
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
