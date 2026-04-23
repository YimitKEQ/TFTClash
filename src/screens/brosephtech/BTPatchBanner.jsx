import React from 'react';
import { CURRENT_SET, PATCHES } from '../../lib/btset17';
import { GlassPanel } from './BTGlass';

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

function StatCard(props) {
  return (
    <GlassPanel
      tone="medium"
      rounded="rounded-2xl"
      padding="px-4 py-3"
      glow={props.glow}
      className="flex items-center gap-3"
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-xl border border-white/20"
        style={{
          background: props.iconBg,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30)',
        }}
      >
        <Icon name={props.icon} className="text-xl" style={{ color: props.iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-white/55 font-semibold uppercase tracking-wider">{props.label}</p>
        <p className="text-white text-sm font-bold truncate">{props.title}</p>
        <p className="text-[11px] font-semibold" style={{ color: props.subColor }}>{props.subtitle}</p>
      </div>
    </GlassPanel>
  );
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
      <StatCard
        glow="teal"
        icon="auto_awesome"
        iconBg="rgba(61,143,160,0.28)"
        iconColor="#9FD8E2"
        label="Current set"
        title={CURRENT_SET.fullName}
        subtitle={setDays > 0 ? setDays + ' days left' : 'Set ended ' + Math.abs(setDays) + 'd ago'}
        subColor="#9FD8E2"
      />

      {nextPatch ? (
        <StatCard
          glow="gold"
          icon="rocket_launch"
          iconBg="rgba(232,160,32,0.28)"
          iconColor="#FFD487"
          label="Next patch"
          title={nextPatch.label}
          subtitle={daysUntil(nextPatch.date) + ' days - ' + formatShort(nextPatch.date)}
          subColor="#FFD487"
        />
      ) : (
        <StatCard
          icon="event"
          iconBg="rgba(255,255,255,0.10)"
          iconColor="rgba(255,255,255,0.60)"
          label="Next patch"
          title="Set ended"
          subtitle="No more patches"
          subColor="rgba(255,255,255,0.50)"
        />
      )}

      <StatCard
        glow={isDrought ? 'pink' : null}
        icon={isDrought ? 'warning' : 'trending_up'}
        iconBg={isDrought ? 'rgba(239,139,140,0.28)' : 'rgba(52,211,153,0.22)'}
        iconColor={isDrought ? '#FFC9CA' : '#6EE7B7'}
        label="Last publish"
        title={publishLabel}
        subtitle={isDrought ? 'Drought - ship something' : 'Cadence healthy'}
        subColor={isDrought ? '#FFC9CA' : '#6EE7B7'}
      />
    </div>
  );
}

export default BTPatchBanner;
