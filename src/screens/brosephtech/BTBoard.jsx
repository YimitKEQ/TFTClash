import React from 'react';
import { supabase } from '../../lib/supabase';

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

function CardModal(props) {
  var [form, setForm] = React.useState(props.initial || EMPTY_FORM);
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

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in" onClick={props.onClose}>
      <div
        className="bg-[#13172a] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl"
        onClick={function(e) { e.stopPropagation(); }}
      >
        <div className="flex items-center justify-between mb-5">
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Title *</label>
            <Inp
              value={form.title}
              onChange={function(e) { set('title', e.target.value); }}
              placeholder="e.g. Set 13 1-cost carries tier list"
              autoFocus
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
            <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Notes</label>
            <textarea
              value={form.description || ''}
              onChange={function(e) { set('description', e.target.value); }}
              rows={3}
              className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB] resize-none transition-colors"
              placeholder="Script ideas, references, links, hooks..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="flex-1 py-2.5 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Icon name="progress_activity" className="animate-spin text-base" />
                  Saving
                </>
              ) : (
                <>
                  <Icon name="check" className="text-base" />
                  {props.isEdit ? 'Save changes' : 'Add card'}
                </>
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

function BTBoard() {
  var [cards, setCards] = React.useState([]);
  var [loading, setLoading] = React.useState(true);
  var [modal, setModal] = React.useState(null);
  var [filterAssignee, setFilterAssignee] = React.useState('');

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
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>Content Board</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {cards.length} cards total
            {filterAssignee && ' - filtered: ' + filterAssignee}
            <span className="ml-3 text-[11px] text-white/25">Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-white/40">N</kbd> for new card</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Sel value={filterAssignee} onChange={function(e) { setFilterAssignee(e.target.value); }}>
            <option value="">All team</option>
            {TEAM.map(function(m) {
              return <option key={m} value={m}>{m}</option>;
            })}
          </Sel>
          <button
            onClick={function() { handleAddCard('ideas'); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#5BA3DB] to-[#4a92ca] hover:from-[#6BB3EB] hover:to-[#5BA3DB] text-white text-sm font-semibold transition-all shadow-lg shadow-[#5BA3DB]/10"
          >
            <Icon name="add" className="text-base" />
            New card
          </button>
        </div>
      </div>

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
      ) : (
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
