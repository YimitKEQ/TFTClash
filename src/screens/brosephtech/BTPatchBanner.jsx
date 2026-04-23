import React from 'react';
import { CURRENT_SET, PATCHES } from '../../lib/btset17';

function Icon(props) {
  return (
    <span className={'material-symbols-outlined ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

function daysUntil(dateStr) {
  var target = new Date(dateStr + 'T00:00:00');
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
}

function formatShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function BTPatchBanner(props) {
  var cards = props.cards || [];

  var nextPatch = PATCHES.find(function(p) { return daysUntil(p.date) > 0; });
  var setDays = daysUntil(CURRENT_SET.endDate);

  var publishedCards = cards
    .filter(function(c) { return c.column_id === 'published'; })
    .sort(function(a, b) {
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });
  var lastPublished = publishedCards[0];

  var droughtDays = null;
  if (lastPublished) {
    var raw = new Date(lastPublished.updated_at || lastPublished.created_at);
    var iso = raw.toISOString().slice(0, 10);
    droughtDays = daysUntil(iso) * -1;
    if (droughtDays < 0) droughtDays = 0;
  }
  var isDrought = droughtDays !== null && droughtDays >= 5;

  var publishLabel;
  if (!lastPublished) publishLabel = 'No publishes yet';
  else if (droughtDays === 0) publishLabel = 'Today';
  else publishLabel = droughtDays + ' day' + (droughtDays === 1 ? '' : 's') + ' ago';

  return (
    <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="bg-gradient-to-br from-[#13172a] to-[#0f1320] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#5BA3DB]/15 flex items-center justify-center shrink-0">
          <Icon name="auto_awesome" className="text-[#5BA3DB] text-xl" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Current set</p>
          <p className="text-white text-sm font-bold truncate">{CURRENT_SET.fullName}</p>
          <p className="text-[11px] text-[#5BA3DB] font-semibold">
            {setDays > 0 ? setDays + ' days left' : 'Set ended ' + Math.abs(setDays) + 'd ago'}
          </p>
        </div>
      </div>

      {nextPatch ? (
        <div className="bg-gradient-to-br from-[#13172a] to-[#0f1320] border border-[#E8A020]/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#E8A020]/15 flex items-center justify-center shrink-0">
            <Icon name="rocket_launch" className="text-[#E8A020] text-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Next patch</p>
            <p className="text-white text-sm font-bold truncate">{nextPatch.label}</p>
            <p className="text-[11px] text-[#E8A020] font-semibold">
              {daysUntil(nextPatch.date)} days - {formatShort(nextPatch.date)}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-[#13172a] to-[#0f1320] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <Icon name="event" className="text-white/40 text-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Next patch</p>
            <p className="text-white/60 text-sm">Set ended - no more patches</p>
          </div>
        </div>
      )}

      <div className={'bg-gradient-to-br rounded-xl px-4 py-3 flex items-center gap-3 border ' + (isDrought ? 'from-red-500/10 to-[#0f1320] border-red-500/30' : 'from-[#13172a] to-[#0f1320] border-emerald-500/20')}>
        <div className={'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ' + (isDrought ? 'bg-red-500/15' : 'bg-emerald-500/15')}>
          <Icon name={isDrought ? 'warning' : 'trending_up'} className={'text-xl ' + (isDrought ? 'text-red-400' : 'text-emerald-400')} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Last publish</p>
          <p className="text-white text-sm font-bold truncate">{publishLabel}</p>
          <p className={'text-[11px] font-semibold ' + (isDrought ? 'text-red-400' : 'text-emerald-400')}>
            {isDrought ? 'Drought - ship something' : 'Cadence healthy'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default BTPatchBanner;
