import React from 'react';
import { supabase } from '../../lib/supabase';
import { PATCHES } from '../../lib/btset17';
import { BT_CREW, getCrewMember, resolveCrewName, cardAssignees } from '../../lib/btcrew';
import useBTSync from './useBTSync';

function ScheduleCrewAvatar(props) {
  var member = getCrewMember(props.name);
  if (!member) return null;
  var size = props.size || 18;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: member.color,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18), 0 3px 8px -3px ' + member.halo,
        fontSize: size >= 28 ? 12 : 10,
      }}
      title={member.name}
    >
      {member.initial}
    </span>
  );
}

var SCHEDULE_TABLES = ['bt_content_cards'];

var COLUMN_COLORS = {
  ideas: '#A78BFA',
  writing: '#5BA3DB',
  production: '#E8A020',
  review: '#EC4899',
  published: '#10B981',
  archive: '#6B7280',
};

var COLUMN_LABELS = {
  ideas: 'Ideas',
  writing: 'Writing',
  production: 'Production',
  review: 'Review',
  published: 'Published',
  archive: 'Archive',
};

var COLUMN_ORDER = ['ideas', 'writing', 'production', 'review', 'published', 'archive'];

var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Icon(props) {
  return (
    <span className={'material-symbols-outlined ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

function isoDay(date) {
  var y = date.getFullYear();
  var m = ('0' + (date.getMonth() + 1)).slice(-2);
  var d = ('0' + date.getDate()).slice(-2);
  return y + '-' + m + '-' + d;
}

function startOfMonthGrid(monthAnchor) {
  var first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  var startOffset = first.getDay();
  var grid = [];
  for (var i = 0; i < 42; i++) {
    var d = new Date(first);
    d.setDate(first.getDate() - startOffset + i);
    grid.push(d);
  }
  return grid;
}

function daysBetween(later, earlier) {
  var ms = later.getTime() - earlier.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function FocusPanel(props) {
  var cards = props.cards || [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayIso = isoDay(today);
  var weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  var weekEndIso = isoDay(weekEnd);

  var dueToday = cards.filter(function(c) {
    return c.due_date === todayIso && c.column_id !== 'published' && c.column_id !== 'archive';
  });
  var overdue = cards.filter(function(c) {
    if (!c.due_date) return false;
    if (c.column_id === 'published' || c.column_id === 'archive') return false;
    return c.due_date < todayIso;
  });
  var dueThisWeek = cards.filter(function(c) {
    if (!c.due_date) return false;
    if (c.column_id === 'published' || c.column_id === 'archive') return false;
    return c.due_date > todayIso && c.due_date <= weekEndIso;
  });

  var stuck = cards.filter(function(c) {
    if (c.column_id !== 'production' && c.column_id !== 'review') return false;
    var ref = new Date(c.updated_at || c.created_at);
    if (isNaN(ref.getTime())) return false;
    return daysBetween(today, ref) >= 5;
  });

  var publishedRecent = cards
    .filter(function(c) { return c.column_id === 'published'; })
    .sort(function(a, b) {
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });
  var lastPub = publishedRecent[0];
  var droughtDays = null;
  if (lastPub) {
    var ref2 = new Date(lastPub.updated_at || lastPub.created_at);
    droughtDays = daysBetween(today, ref2);
    if (droughtDays < 0) droughtDays = 0;
  }

  var bullets = [
    { label: 'Due today', count: dueToday.length, icon: 'today', color: '#5BA3DB', cards: dueToday },
    { label: 'Overdue', count: overdue.length, icon: 'priority_high', color: overdue.length > 0 ? '#EF4444' : '#6B7280', cards: overdue },
    { label: 'Due this week', count: dueThisWeek.length, icon: 'date_range', color: '#E8A020', cards: dueThisWeek },
    { label: 'Stuck 5+ days', count: stuck.length, icon: 'hourglass_top', color: stuck.length > 0 ? '#EC4899' : '#6B7280', cards: stuck },
  ];

  var droughtTone = droughtDays === null
    ? 'No publishes yet'
    : droughtDays === 0
      ? 'Shipped today - keep the streak'
      : droughtDays + (droughtDays === 1 ? ' day' : ' days') + ' since last publish';

  return (
    <div className="bg-gradient-to-br from-[#13172a] via-[#0f1320] to-[#0b0e1a] border border-white/5 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5BA3DB]/15 flex items-center justify-center">
            <Icon name="wb_sunny" className="text-[#5BA3DB] text-xl" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Subtle, system-ui, sans-serif' }}>Today's Focus</h3>
            <p className="text-[11px] text-white/40 mt-0.5 tracking-wide">
              {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <div className={'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ' + (droughtDays !== null && droughtDays >= 5 ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/10 text-emerald-400')}>
          <Icon name={droughtDays !== null && droughtDays >= 5 ? 'warning' : 'rocket_launch'} className="text-base" />
          {droughtTone}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {bullets.map(function(b) {
          return (
            <div key={b.label} className="bg-[#0b0e1a] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
              <Icon name={b.icon} className="text-xl" style={{ color: b.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold text-white leading-none tabular-nums">{b.count}</p>
                <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider font-semibold truncate">{b.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {dueToday.length === 0 && overdue.length === 0 ? (
        <div className="bg-[#0b0e1a]/60 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Icon name="check_circle" className="text-emerald-400 text-xl" />
          <p className="text-sm text-white/80">Inbox zero on the schedule. Pick from the Board or queue something new.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(overdue.length > 0 ? overdue : dueToday).slice(0, 6).map(function(c) {
            var bg = COLUMN_COLORS[c.column_id] || '#6B7280';
            return (
              <button
                key={c.id}
                onClick={function() { props.onCardClick(c); }}
                className="text-left bg-[#0b0e1a] border border-white/5 hover:border-[#5BA3DB]/40 hover:-translate-y-0.5 transition-all rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <span className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: bg }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{c.title}</p>
                  <p className="text-[11px] text-white/40 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>{COLUMN_LABELS[c.column_id]}</span>
                    {cardAssignees(c).map(function(name) {
                      return (
                        <span key={name} className="inline-flex items-center gap-1 text-white/60">
                          <ScheduleCrewAvatar name={name} />
                          {name}
                        </span>
                      );
                    })}
                  </p>
                </div>
                <Icon name="arrow_forward" className="text-white/30 text-base shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardChip(props) {
  var c = props.card;
  var color = COLUMN_COLORS[c.column_id] || '#6B7280';

  function handleDragStart(e) {
    e.dataTransfer.setData('cardId', c.id);
    e.dataTransfer.setData('sourceDate', c.due_date || '');
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={function(e) { e.stopPropagation(); props.onClick(c); }}
      className="text-left bg-[#0b0e1a] hover:bg-[#13172a] border-l-2 px-1.5 py-1 rounded text-[10px] truncate cursor-pointer transition-colors"
      style={{ borderColor: color, color: '#E2E8F0' }}
      title={c.title + ' (' + COLUMN_LABELS[c.column_id] + ')'}
    >
      <span className="truncate block">{c.title}</span>
    </div>
  );
}

function MonthCalendar(props) {
  var monthAnchor = props.monthAnchor;
  var cards = props.cards;
  var grid = startOfMonthGrid(monthAnchor);
  var monthIdx = monthAnchor.getMonth();
  var todayIso = isoDay(new Date());

  function patchOnDate(iso) {
    return PATCHES.find(function(p) { return p.date === iso; });
  }

  function cardsOnDate(iso) {
    return cards.filter(function(c) { return c.due_date === iso; });
  }

  function handleDayDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('bg-[#5BA3DB]/8', 'border-[#5BA3DB]/30');
  }

  function handleDayDragLeave(e) {
    e.currentTarget.classList.remove('bg-[#5BA3DB]/8', 'border-[#5BA3DB]/30');
  }

  function handleDayDrop(e, iso) {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-[#5BA3DB]/8', 'border-[#5BA3DB]/30');
    var cardId = e.dataTransfer.getData('cardId');
    var sourceDate = e.dataTransfer.getData('sourceDate');
    if (!cardId || sourceDate === iso) return;
    props.onMoveCard(cardId, iso);
  }

  return (
    <div className="bg-[#13172a] border border-white/5 rounded-2xl p-4">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DOW.map(function(d) {
          return (
            <div key={d} className="text-[10px] text-white/40 font-bold uppercase tracking-wider text-center pb-2">
              {d}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map(function(day, idx) {
          var iso = isoDay(day);
          var inMonth = day.getMonth() === monthIdx;
          var isToday = iso === todayIso;
          var dayCards = cardsOnDate(iso);
          var patch = patchOnDate(iso);

          var sortedCards = dayCards.slice().sort(function(a, b) {
            return COLUMN_ORDER.indexOf(a.column_id) - COLUMN_ORDER.indexOf(b.column_id);
          });
          var visibleCards = sortedCards.slice(0, 3);
          var overflow = dayCards.length - visibleCards.length;

          var baseCls = 'group relative min-h-[92px] p-1.5 rounded-lg border transition-all flex flex-col gap-1 ';
          var stateCls;
          if (!inMonth) {
            stateCls = 'opacity-30 border-transparent';
          } else if (isToday) {
            stateCls = 'border-[#E8A020]/40 bg-[#E8A020]/5';
          } else if (patch) {
            stateCls = 'border-[#E8A020]/30 bg-[#0b0e1a]';
          } else {
            stateCls = 'border-white/5 bg-[#0b0e1a] hover:border-white/10';
          }

          return (
            <div
              key={idx}
              onDragOver={handleDayDragOver}
              onDragLeave={handleDayDragLeave}
              onDrop={function(e) { handleDayDrop(e, iso); }}
              onClick={function() { if (inMonth) props.onDayClick(iso); }}
              className={baseCls + stateCls + (inMonth ? ' cursor-pointer' : '')}
            >
              <div className="flex items-center justify-between">
                <span className={'text-[11px] font-bold tabular-nums ' + (isToday ? 'text-[#E8A020]' : inMonth ? 'text-white/70' : 'text-white/30')}>
                  {day.getDate()}
                </span>
                {patch && (
                  <span className="text-[9px] px-1 rounded bg-[#E8A020]/20 text-[#E8A020] font-bold uppercase tracking-wider" title={'Patch ' + patch.label + (patch.notes ? ' - ' + patch.notes : '')}>
                    {patch.label}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                {visibleCards.map(function(c) {
                  return <CardChip key={c.id} card={c} onClick={props.onCardClick} />;
                })}
                {overflow > 0 && (
                  <span className="text-[9px] text-white/40 font-semibold px-1">+{overflow} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardDetailDrawer(props) {
  var c = props.card;
  var onCloseRef = React.useRef(props.onClose);
  onCloseRef.current = props.onClose;

  React.useEffect(function() {
    function onKey(e) { if (e.key === 'Escape') onCloseRef.current(); }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, []);

  if (!c) return null;
  var color = COLUMN_COLORS[c.column_id] || '#6B7280';
  var hasBrief = !!(c.brief && (
    (c.brief.hookLine && c.brief.hookLine.trim()) ||
    (c.brief.talkingPoints && c.brief.talkingPoints.length) ||
    (c.brief.titleOptions && c.brief.titleOptions.length)
  ));

  var nextColumn = null;
  var idx = COLUMN_ORDER.indexOf(c.column_id);
  if (idx >= 0 && idx < COLUMN_ORDER.length - 2) {
    nextColumn = COLUMN_ORDER[idx + 1];
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm" onClick={props.onClose}>
      <div
        className="w-full max-w-md bg-[#13172a] border-l border-white/10 h-full overflow-y-auto"
        onClick={function(e) { e.stopPropagation(); }}
      >
        <div className="p-5 border-b border-white/5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: color }}>{COLUMN_LABELS[c.column_id]}</span>
              {c.patch_id && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 font-semibold">{c.patch_id}</span>
              )}
            </div>
            <h3 className="text-white font-bold text-base leading-snug">{c.title}</h3>
          </div>
          <button onClick={props.onClose} className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5 shrink-0">
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div className="bg-[#0b0e1a] rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Due</p>
              <p className="text-white mt-0.5">{c.due_date || 'Unscheduled'}</p>
            </div>
            <div className="bg-[#0b0e1a] rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Crew</p>
              {(function() {
                var names = cardAssignees(c);
                if (names.length === 0) return <p className="text-white/50 mt-0.5">Unassigned</p>;
                return (
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {names.map(function(name) {
                      return (
                        <span key={name} className="inline-flex items-center gap-1 text-white text-[12px]">
                          <ScheduleCrewAvatar name={name} size={18} />
                          <span className="truncate">{name}</span>
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="bg-[#0b0e1a] rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Type</p>
              <p className="text-white mt-0.5 capitalize">{c.content_type}</p>
            </div>
            <div className="bg-[#0b0e1a] rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Platform</p>
              <p className="text-white mt-0.5 uppercase">{c.platform}</p>
            </div>
          </div>

          {c.description && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1.5">Notes</p>
              <p className="text-sm text-white/80 whitespace-pre-line bg-[#0b0e1a] rounded-lg px-3 py-2 leading-relaxed">{c.description}</p>
            </div>
          )}

          {hasBrief && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#E8A020] font-bold mb-2 flex items-center gap-1">
                <Icon name="auto_stories" className="text-sm" />
                Brief
              </p>
              <div className="bg-[#E8A020]/5 border border-[#E8A020]/15 rounded-lg p-3 flex flex-col gap-3">
                {c.brief.hookLine && c.brief.hookLine.trim() && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Hook</p>
                    <p className="text-sm text-white/85 italic">"{c.brief.hookLine}"</p>
                  </div>
                )}
                {c.brief.talkingPoints && c.brief.talkingPoints.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Talking points</p>
                    <ul className="list-decimal list-inside text-sm text-white/80 flex flex-col gap-0.5">
                      {c.brief.talkingPoints.map(function(p, i) {
                        return <li key={i}>{p}</li>;
                      })}
                    </ul>
                  </div>
                )}
                {c.brief.chosenTitle && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Chosen title</p>
                    <p className="text-sm text-white font-semibold">{c.brief.chosenTitle}</p>
                  </div>
                )}
                {c.brief.cta && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">CTA</p>
                    <p className="text-sm text-white/80">{c.brief.cta}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {nextColumn && (
              <button
                onClick={function() { props.onAdvance(c, nextColumn); }}
                className="w-full py-2.5 rounded-xl bg-[#5BA3DB] hover:bg-[#4a92ca] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="arrow_forward" className="text-base" />
                Advance to {COLUMN_LABELS[nextColumn]}
              </button>
            )}
            <button
              onClick={function() { props.onClearDate(c); }}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Icon name="event_busy" className="text-base" />
              Clear due date
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgendaView(props) {
  var cards = props.cards || [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var days = [];
  for (var i = 0; i < 21; i++) {
    var d = new Date(today);
    d.setDate(today.getDate() + i);
    var iso = isoDay(d);
    var dayCards = cards.filter(function(c) { return c.due_date === iso; });
    var patch = PATCHES.find(function(p) { return p.date === iso; });
    if (dayCards.length || patch || i === 0) {
      days.push({ date: d, iso: iso, cards: dayCards, patch: patch });
    }
  }

  if (days.length === 0) {
    return (
      <div className="bg-[#13172a] border border-white/5 rounded-xl p-6 text-center">
        <Icon name="event_available" className="text-3xl text-white/20" />
        <p className="text-sm text-white/60 mt-2">Nothing scheduled in the next 3 weeks.</p>
        <p className="text-xs text-white/40 mt-1">Tap a day on the calendar to add a card.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {days.map(function(day) {
        var isToday = day.iso === isoDay(today);
        var dow = day.date.toLocaleDateString('en-GB', { weekday: 'short' });
        var label = day.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        return (
          <div
            key={day.iso}
            className={'bg-[#13172a] border rounded-xl overflow-hidden ' + (isToday ? 'border-[#5BA3DB]/40' : 'border-white/5')}
          >
            <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                <div className={'w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0 ' + (isToday ? 'bg-[#5BA3DB]/15 text-[#5BA3DB]' : 'bg-white/5 text-white/70')}>
                  <span className="text-[9px] uppercase font-bold leading-none">{dow}</span>
                  <span className="text-sm font-bold leading-none mt-0.5">{day.date.getDate()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white leading-tight">{isToday ? 'Today' : label}</p>
                  {day.patch ? (
                    <p className="text-[10px] text-[#E8A020] font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1">
                      <Icon name="rocket_launch" className="text-[11px]" />
                      {day.patch.label} {day.patch.notes ? '- ' + day.patch.notes : ''}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                onClick={function() { props.onDayClick(day.iso); }}
                className="w-9 h-9 rounded-lg bg-white/5 active:bg-white/10 text-white/60 flex items-center justify-center"
                title="Add card on this day"
              >
                <Icon name="add" className="text-base" />
              </button>
            </div>
            {day.cards.length ? (
              <div className="p-2 space-y-1.5">
                {day.cards.map(function(card) {
                  var color = COLUMN_COLORS[card.column_id] || '#6B7280';
                  return (
                    <button
                      key={card.id}
                      onClick={function() { props.onCardClick(card); }}
                      className="w-full text-left bg-[#0b0e1a] border border-white/5 rounded-lg px-3 py-2 active:bg-[#0e1222] flex items-center gap-2"
                    >
                      <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{card.title || 'Untitled'}</p>
                        <p className="text-[10px] uppercase tracking-wider font-bold mt-0.5" style={{ color: color }}>
                          {COLUMN_LABELS[card.column_id]}
                        </p>
                      </div>
                      <Icon name="chevron_right" className="text-white/30 text-base shrink-0" />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StandupView(props) {
  var cards = props.cards || [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  var todayIso = isoDay(today);
  var tomorrowIso = isoDay(tomorrow);
  var overdueCutoff = todayIso;

  function isActive(c) {
    return c.column_id !== 'published' && c.column_id !== 'archive';
  }

  var overdue = cards.filter(function(c) { return isActive(c) && c.due_date && c.due_date < overdueCutoff; });
  var dueToday = cards.filter(function(c) { return isActive(c) && c.due_date === todayIso; });
  var dueTomorrow = cards.filter(function(c) { return isActive(c) && c.due_date === tomorrowIso; });
  var inReview = cards.filter(function(c) { return c.column_id === 'review'; });
  var unscheduled = cards.filter(function(c) { return isActive(c) && !c.due_date && c.column_id !== 'ideas'; });

  var rows = BT_CREW.map(function(member) {
    function mine(list) {
      return list.filter(function(c) { return cardAssignees(c).indexOf(member.name) !== -1; });
    }
    var mineOverdue = mine(overdue);
    var mineToday = mine(dueToday);
    var mineTomorrow = mine(dueTomorrow);
    var mineReview = mine(inReview);
    var mineActive = cards.filter(function(c) {
      return isActive(c) && cardAssignees(c).indexOf(member.name) !== -1;
    });
    return {
      member: member,
      overdue: mineOverdue,
      today: mineToday,
      tomorrow: mineTomorrow,
      review: mineReview,
      activeCount: mineActive.length,
    };
  });

  function Bucket(bucketProps) {
    if (!bucketProps.cards || bucketProps.cards.length === 0) return null;
    return (
      <div className="mt-1.5">
        <p
          className="text-[10px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1"
          style={{ color: bucketProps.color }}
        >
          <Icon name={bucketProps.icon} className="text-[12px]" />
          {bucketProps.label}
          <span className="text-white/35 font-semibold tabular-nums">{bucketProps.cards.length}</span>
        </p>
        <div className="flex flex-col gap-1">
          {bucketProps.cards.map(function(c) {
            var colColor = COLUMN_COLORS[c.column_id] || '#6B7280';
            return (
              <button
                type="button"
                key={c.id}
                onClick={function() { props.onCardClick(c); }}
                className="w-full text-left bg-[#0b0e1a] hover:bg-[#13172a] border border-white/5 rounded-lg px-2.5 py-1.5 flex items-center gap-2 transition-colors"
              >
                <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: colColor }} />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-[12px] font-semibold truncate leading-tight">{c.title || 'Untitled'}</p>
                  <p className="text-[10px] text-white/40 truncate">
                    {COLUMN_LABELS[c.column_id]}
                    {c.due_date && ' - ' + new Date(c.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  var unassignedOverdue = overdue.filter(function(c) { return cardAssignees(c).length === 0; });
  var unassignedToday = dueToday.filter(function(c) { return cardAssignees(c).length === 0; });
  var unassignedTomorrow = dueTomorrow.filter(function(c) { return cardAssignees(c).length === 0; });
  var unassignedReview = inReview.filter(function(c) { return cardAssignees(c).length === 0; });
  var hasUnassigned = unassignedOverdue.length + unassignedToday.length + unassignedTomorrow.length + unassignedReview.length > 0;

  var dateHeader = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#5BA3DB]/10 via-[#13172a] to-[#13172a] border border-[#5BA3DB]/25 rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#5BA3DB] font-bold">Daily standup</p>
            <p className="text-white text-base font-bold leading-tight mt-0.5">{dateHeader}</p>
            <p className="text-[11px] text-white/55 mt-0.5">What's due, what's overdue, and what's with whom. Click any card to open it.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-2 py-1 rounded-lg font-semibold uppercase tracking-wide bg-red-500/15 text-red-300" title="Overdue across crew">
              <span className="tabular-nums">{overdue.length}</span> overdue
            </span>
            <span className="text-[10px] px-2 py-1 rounded-lg font-semibold uppercase tracking-wide bg-[#E8A020]/15 text-[#FFD487]">
              <span className="tabular-nums">{dueToday.length}</span> due today
            </span>
            <span className="text-[10px] px-2 py-1 rounded-lg font-semibold uppercase tracking-wide bg-[#5BA3DB]/15 text-[#7CC0EE]">
              <span className="tabular-nums">{dueTomorrow.length}</span> tomorrow
            </span>
            <span className="text-[10px] px-2 py-1 rounded-lg font-semibold uppercase tracking-wide bg-[#EC4899]/15 text-[#F472B6]">
              <span className="tabular-nums">{inReview.length}</span> in review
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {rows.map(function(row) {
          var empty = row.overdue.length + row.today.length + row.tomorrow.length + row.review.length === 0;
          return (
            <div
              key={row.member.id}
              className="bg-[#13172a] border border-white/5 rounded-2xl p-3.5"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px -6px ' + row.member.halo }}
            >
              <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                <ScheduleCrewAvatar name={row.member.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-bold leading-tight">{row.member.name}</p>
                  <p className="text-[10px] text-white/40">{row.activeCount} active card{row.activeCount === 1 ? '' : 's'}</p>
                </div>
                {empty && (
                  <span className="text-[10px] text-white/30 italic">Clear today</span>
                )}
              </div>
              <Bucket label="Overdue" icon="warning" color="#FCA5A5" cards={row.overdue} />
              <Bucket label="Due today" icon="today" color="#FFD487" cards={row.today} />
              <Bucket label="Due tomorrow" icon="schedule" color="#7CC0EE" cards={row.tomorrow} />
              <Bucket label="In review" icon="visibility" color="#F472B6" cards={row.review} />
              {empty && (
                <p className="text-[11px] text-white/30 mt-2">No overdue, due, or review items - good runway.</p>
              )}
            </div>
          );
        })}
      </div>

      {hasUnassigned && (
        <div className="bg-[#13172a] border border-white/8 rounded-2xl p-3.5">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <span className="material-symbols-outlined text-white/40 text-base">person_off</span>
            <p className="text-white text-sm font-bold">Unassigned</p>
            <p className="text-[10px] text-white/30 ml-auto">Needs an owner</p>
          </div>
          <Bucket label="Overdue" icon="warning" color="#FCA5A5" cards={unassignedOverdue} />
          <Bucket label="Due today" icon="today" color="#FFD487" cards={unassignedToday} />
          <Bucket label="Due tomorrow" icon="schedule" color="#7CC0EE" cards={unassignedTomorrow} />
          <Bucket label="In review" icon="visibility" color="#F472B6" cards={unassignedReview} />
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="bg-[#0b0e1a]/70 border border-dashed border-white/10 rounded-2xl p-3.5">
          <div className="flex items-center gap-2 pb-1.5">
            <span className="material-symbols-outlined text-white/40 text-base">event_busy</span>
            <p className="text-white text-sm font-semibold">Active but no due date</p>
            <p className="text-[10px] text-white/30 ml-auto tabular-nums">{unscheduled.length}</p>
          </div>
          <p className="text-[11px] text-white/40 mb-2">These are in flight but not scheduled - pick a date before they slip.</p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.slice(0, 12).map(function(c) {
              var names = cardAssignees(c);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={function() { props.onCardClick(c); }}
                  className="flex items-center gap-1.5 bg-[#13172a] hover:bg-[#1a1f36] border border-white/8 rounded-full pl-1 pr-2.5 py-0.5 text-[11px] text-white/80 transition-colors"
                  title={c.title}
                >
                  {names.length > 0 ? <ScheduleCrewAvatar name={names[0]} size={18} /> : <span className="w-4 h-4 rounded-full bg-white/5" />}
                  <span className="truncate max-w-[160px]">{c.title}</span>
                </button>
              );
            })}
            {unscheduled.length > 12 && (
              <span className="text-[10px] text-white/30 self-center pl-1">+{unscheduled.length - 12} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BTSchedule() {
  var [cards, setCards] = React.useState([]);
  var [loading, setLoading] = React.useState(true);
  var [monthAnchor, setMonthAnchor] = React.useState(function() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  var [selectedCard, setSelectedCard] = React.useState(null);
  var [view, setView] = React.useState(function() {
    if (typeof window === 'undefined') return 'calendar';
    return window.innerWidth < 640 ? 'agenda' : 'calendar';
  });

  React.useEffect(function() { loadCards(); }, []);

  useBTSync(SCHEDULE_TABLES, function() { loadCards(); });

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

  function moveCardToDate(cardId, newDate) {
    supabase
      .from('bt_content_cards')
      .update({ due_date: newDate, updated_at: new Date().toISOString() })
      .eq('id', cardId)
      .then(function(res) {
        if (res.error) {
          console.error('bt_content_cards reschedule failed', res.error);
          return;
        }
        loadCards();
      });
  }

  function clearCardDate(card) {
    supabase
      .from('bt_content_cards')
      .update({ due_date: null, updated_at: new Date().toISOString() })
      .eq('id', card.id)
      .then(function(res) {
        if (res.error) {
          console.error('bt_content_cards clear date failed', res.error);
          return;
        }
        loadCards();
        setSelectedCard(null);
      });
  }

  function advanceCard(card, newColumnId) {
    supabase
      .from('bt_content_cards')
      .update({ column_id: newColumnId, updated_at: new Date().toISOString() })
      .eq('id', card.id)
      .then(function(res) {
        if (res.error) {
          console.error('bt_content_cards advance failed', res.error);
          return;
        }
        loadCards();
        setSelectedCard(function(prev) {
          return prev ? Object.assign({}, prev, { column_id: newColumnId }) : null;
        });
      });
  }

  function createOnDate(iso) {
    var title = window.prompt('Quick card title for ' + iso + ':', '');
    if (!title || !title.trim()) return;
    var payload = {
      title: title.trim(),
      column_id: 'ideas',
      content_type: 'short',
      platform: 'both',
      assignee: '',
      priority: 'medium',
      due_date: iso,
    };
    supabase
      .from('bt_content_cards')
      .insert(payload)
      .then(function(res) {
        if (res.error) {
          console.error('bt_content_cards quick create failed', res.error);
          return;
        }
        loadCards();
      });
  }

  function shiftMonth(delta) {
    setMonthAnchor(function(prev) {
      return new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
    });
  }

  function jumpToToday() {
    var d = new Date();
    setMonthAnchor(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/30">
        <Icon name="progress_activity" className="animate-spin text-3xl mr-3" />
        Loading schedule...
      </div>
    );
  }

  var monthLabel = monthAnchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Subtle, system-ui, sans-serif' }}>Schedule</h2>
          <p className="text-sm text-white/40 mt-0.5 hidden sm:block">Drag cards across days to reschedule. Patch days are highlighted gold.</p>
          <p className="text-xs text-white/40 mt-0.5 sm:hidden">Tap any day to add a card.</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="inline-flex bg-[#13172a] border border-white/5 rounded-xl p-0.5">
            <button
              onClick={function() { setView('standup'); }}
              className={'flex items-center gap-1 px-2.5 h-9 text-xs font-semibold rounded-lg transition-all ' + (view === 'standup' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80')}
              title="Daily standup grouped by crew"
            >
              <Icon name="groups" className="text-base" />
              <span className="hidden sm:inline">Standup</span>
            </button>
            <button
              onClick={function() { setView('agenda'); }}
              className={'flex items-center gap-1 px-2.5 h-9 text-xs font-semibold rounded-lg transition-all ' + (view === 'agenda' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80')}
            >
              <Icon name="view_agenda" className="text-base" />
              <span className="hidden sm:inline">Agenda</span>
            </button>
            <button
              onClick={function() { setView('calendar'); }}
              className={'flex items-center gap-1 px-2.5 h-9 text-xs font-semibold rounded-lg transition-all ' + (view === 'calendar' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80')}
            >
              <Icon name="calendar_month" className="text-base" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>
          {view === 'calendar' ? (
            <div className="flex items-center gap-1">
              <button
                onClick={function() { shiftMonth(-1); }}
                className="w-9 h-9 rounded-lg bg-[#13172a] hover:bg-[#1a1f36] border border-white/5 text-white/70 flex items-center justify-center transition-colors"
                title="Previous month"
              >
                <Icon name="chevron_left" className="text-lg" />
              </button>
              <button
                onClick={jumpToToday}
                className="px-3 h-9 rounded-lg bg-[#13172a] hover:bg-[#1a1f36] border border-white/5 text-white/70 hover:text-white text-xs font-semibold transition-colors"
              >
                Today
              </button>
              <button
                onClick={function() { shiftMonth(1); }}
                className="w-9 h-9 rounded-lg bg-[#13172a] hover:bg-[#1a1f36] border border-white/5 text-white/70 flex items-center justify-center transition-colors"
                title="Next month"
              >
                <Icon name="chevron_right" className="text-lg" />
              </button>
              <span className="ml-2 text-sm font-semibold text-white tabular-nums whitespace-nowrap">{monthLabel}</span>
            </div>
          ) : null}
        </div>
      </div>

      {view !== 'standup' && (
        <FocusPanel cards={cards} onCardClick={setSelectedCard} />
      )}

      {view === 'calendar' && (
        <MonthCalendar
          monthAnchor={monthAnchor}
          cards={cards}
          onCardClick={setSelectedCard}
          onMoveCard={moveCardToDate}
          onDayClick={createOnDate}
        />
      )}
      {view === 'agenda' && (
        <AgendaView
          cards={cards}
          onCardClick={setSelectedCard}
          onDayClick={createOnDate}
        />
      )}
      {view === 'standup' && (
        <StandupView
          cards={cards}
          onCardClick={setSelectedCard}
        />
      )}

      {selectedCard && (
        <CardDetailDrawer
          card={selectedCard}
          onClose={function() { setSelectedCard(null); }}
          onAdvance={advanceCard}
          onClearDate={clearCardDate}
        />
      )}
    </div>
  );
}

export default BTSchedule;
