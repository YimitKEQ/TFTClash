import React from 'react';
import { supabase } from '../../lib/supabase';

var METRICS = [
  { key: 'yt_subs',          label: 'YouTube Subs',     icon: 'play_circle',         color: '#FF0000' },
  { key: 'tiktok_followers', label: 'TikTok Followers', icon: 'music_note',          color: '#E8A020' },
  { key: 'patreon_subs',     label: 'Patreon Members',  icon: 'volunteer_activism',  color: '#FF424D' },
  { key: 'avg_views',        label: 'Avg Views/Video',  icon: 'bar_chart',           color: '#5BA3DB' },
];

function makeEmptyForm() {
  return {
    snapshot_date: new Date().toISOString().slice(0, 10),
    yt_subs: '',
    tiktok_followers: '',
    patreon_subs: '',
    avg_views: '',
    notes: '',
  };
}

function Icon(props) {
  return (
    <span className={'material-symbols-outlined ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

function Sparkline(props) {
  var values = props.values || [];
  if (values.length < 2) return null;
  var max = Math.max.apply(null, values);
  var min = Math.min.apply(null, values);
  var range = max - min || 1;
  var width = 80;
  var height = 24;
  var points = values.map(function(v, i) {
    var x = (i / (values.length - 1)) * width;
    var y = height - ((v - min) / range) * height;
    return x + ',' + y;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={props.color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle
        cx={width}
        cy={height - ((values[values.length - 1] - min) / range) * height}
        r="2.5"
        fill={props.color}
      />
    </svg>
  );
}

function KpiCard(props) {
  var delta = props.delta;
  var pct = null;
  if (delta !== null && delta !== undefined && props.previous) {
    pct = props.previous > 0 ? ((delta / props.previous) * 100) : null;
  }
  var positive = delta !== null && delta > 0;
  var negative = delta !== null && delta < 0;

  return (
    <div className="bg-gradient-to-br from-[#13172a] to-[#0f1320] border border-white/5 rounded-2xl p-5 relative overflow-hidden hover:border-white/10 transition-colors">
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 blur-2xl"
        style={{ backgroundColor: props.color }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: props.color + '20' }}
            >
              <Icon name={props.icon} style={{ color: props.color }} className="text-lg" />
            </span>
            <span className="text-xs text-white/60 font-semibold uppercase tracking-wide">{props.label}</span>
          </div>
          {props.sparklineValues && props.sparklineValues.length > 1 && (
            <Sparkline values={props.sparklineValues} color={props.color} />
          )}
        </div>
        <p className="text-3xl font-bold text-white leading-none tracking-tight" style={{ fontFamily: 'Russo One, sans-serif' }}>
          {props.value !== null && props.value !== undefined ? Number(props.value).toLocaleString() : '--'}
        </p>
        {delta !== null && delta !== undefined && delta !== 0 ? (
          <div className={'flex items-center gap-1 mt-2 text-xs font-semibold ' + (positive ? 'text-emerald-400' : negative ? 'text-red-400' : 'text-white/30')}>
            <Icon name={positive ? 'trending_up' : 'trending_down'} className="text-sm" />
            {positive ? '+' : ''}{Number(delta).toLocaleString()}
            {pct !== null && (
              <span className="text-white/40 font-normal">({positive ? '+' : ''}{pct.toFixed(1)}%)</span>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-white/25 mt-2">No prior snapshot</p>
        )}
      </div>
    </div>
  );
}

function BTMetrics() {
  var [snapshots, setSnapshots] = React.useState([]);
  var [loading, setLoading] = React.useState(true);
  var [form, setForm] = React.useState(makeEmptyForm);
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
        if (res.error) {
          console.error('bt_metrics_snapshots load failed', res.error);
          setLoading(false);
          return;
        }
        setSnapshots(res.data || []);
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
      .then(function(res) {
        if (res.error) {
          console.error('bt_metrics_snapshots insert failed', res.error);
          setSaving(false);
          return;
        }
        loadSnapshots();
        setForm(makeEmptyForm());
        setShowForm(false);
        setSaving(false);
      });
  }

  function handleDeleteSnapshot(id) {
    if (!window.confirm('Delete this snapshot?')) return;
    supabase
      .from('bt_metrics_snapshots')
      .delete()
      .eq('id', id)
      .then(function(res) {
        if (res.error) {
          console.error('bt_metrics_snapshots delete failed', res.error);
          return;
        }
        loadSnapshots();
      });
  }

  var latest = snapshots[0] || null;
  var previous = snapshots[1] || null;
  var ordered = snapshots.slice().reverse();

  function getDelta(key) {
    if (!latest || !previous) return null;
    return (latest[key] || 0) - (previous[key] || 0);
  }

  function getSparkline(key) {
    if (ordered.length < 2) return null;
    return ordered.slice(-8).map(function(s) { return s[key] || 0; });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>Channel Metrics</h2>
          <p className="text-sm text-white/40 mt-0.5">Log snapshots to track BrosephTech growth over time</p>
        </div>
        <button
          onClick={function() { setShowForm(function(v) { return !v; }); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#E8A020] to-[#D48B10] hover:from-[#F8B030] hover:to-[#E8A020] text-white text-sm font-semibold transition-all shadow-lg shadow-[#E8A020]/10"
        >
          <Icon name={showForm ? 'close' : 'add'} className="text-base" />
          {showForm ? 'Cancel' : 'Log snapshot'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {METRICS.map(function(m) {
          return (
            <KpiCard
              key={m.key}
              label={m.label}
              icon={m.icon}
              color={m.color}
              value={latest ? latest[m.key] : null}
              previous={previous ? previous[m.key] : null}
              delta={getDelta(m.key)}
              sparklineValues={getSparkline(m.key)}
            />
          );
        })}
      </div>

      {showForm && (
        <div className="bg-gradient-to-br from-[#13172a] to-[#0f1320] border border-[#E8A020]/20 rounded-2xl p-6 mb-6 shadow-lg shadow-[#E8A020]/5">
          <div className="flex items-center gap-2 mb-5">
            <Icon name="add_chart" className="text-[#E8A020] text-xl" />
            <h3 className="text-white font-semibold">Log new snapshot</h3>
            <p className="text-xs text-white/40 ml-auto">Paste your current numbers from each platform</p>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="col-span-2 lg:col-span-1">
              <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={form.snapshot_date}
                onChange={function(e) { setField('snapshot_date', e.target.value); }}
                className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E8A020] transition-colors"
              />
            </div>
            {METRICS.map(function(m) {
              return (
                <div key={m.key}>
                  <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider flex items-center gap-1">
                    <Icon name={m.icon} className="text-xs" style={{ color: m.color }} />
                    {m.label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form[m.key]}
                    onChange={function(e) { setField(m.key, e.target.value); }}
                    className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E8A020] transition-colors"
                    placeholder="0"
                  />
                </div>
              );
            })}
            <div className="col-span-2 lg:col-span-3">
              <label className="text-[11px] text-white/40 mb-1.5 block font-semibold uppercase tracking-wider">Notes (optional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={function(e) { setField('notes', e.target.value); }}
                className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#E8A020] transition-colors"
                placeholder="e.g. Viral short boosted TT, launched Patreon, Set 13 launch"
              />
            </div>
            <div className="col-span-2 lg:col-span-3 flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[#E8A020] hover:bg-[#F8B030] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Icon name="progress_activity" className="animate-spin text-base" />
                    Saving
                  </>
                ) : (
                  <>
                    <Icon name="check" className="text-base" />
                    Save snapshot
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={function() { setShowForm(false); }}
                className="px-6 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/25 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center text-white/30 py-12 flex items-center justify-center">
          <Icon name="progress_activity" className="animate-spin text-2xl mr-2" />
          Loading...
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 bg-[#13172a]/40 border border-dashed border-white/10 rounded-2xl">
          <Icon name="bar_chart_4_bars" className="text-5xl text-white/20 mb-3" />
          <p className="text-white/60 text-sm font-semibold mb-1">No snapshots yet</p>
          <p className="text-white/30 text-xs mb-5">Log your first one to start tracking growth</p>
          <button
            onClick={function() { setShowForm(true); }}
            className="px-5 py-2 rounded-xl bg-[#E8A020] hover:bg-[#F8B030] text-white text-sm font-semibold transition-colors"
          >
            Log first snapshot
          </button>
        </div>
      ) : (
        <div className="bg-[#13172a] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-white text-sm font-semibold flex items-center gap-2">
              <Icon name="history" className="text-[#5BA3DB] text-base" />
              Snapshot history
            </h3>
            <span className="text-xs text-white/40">{snapshots.length} entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-[#0b0e1a]/40">
                  <th className="text-left text-[11px] text-white/40 font-semibold uppercase tracking-wider px-5 py-2.5">Date</th>
                  <th className="text-right text-[11px] text-white/40 font-semibold uppercase tracking-wider px-4 py-2.5">YT</th>
                  <th className="text-right text-[11px] text-white/40 font-semibold uppercase tracking-wider px-4 py-2.5">TikTok</th>
                  <th className="text-right text-[11px] text-white/40 font-semibold uppercase tracking-wider px-4 py-2.5">Patreon</th>
                  <th className="text-right text-[11px] text-white/40 font-semibold uppercase tracking-wider px-4 py-2.5">Avg Views</th>
                  <th className="text-left text-[11px] text-white/40 font-semibold uppercase tracking-wider px-4 py-2.5">Notes</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map(function(s, i) {
                  return (
                    <tr key={s.id} className={'border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors ' + (i === 0 ? 'bg-[#5BA3DB]/[0.04]' : '')}>
                      <td className="px-5 py-3 text-white font-medium">
                        <div className="flex items-center gap-2">
                          {i === 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#5BA3DB] animate-pulse" />}
                          {new Date(s.snapshot_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-white tabular-nums">{(s.yt_subs || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-white tabular-nums">{(s.tiktok_followers || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-white tabular-nums">{(s.patreon_subs || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-white tabular-nums">{(s.avg_views || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-white/50 text-xs max-w-[200px] truncate">{s.notes || '--'}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={function() { handleDeleteSnapshot(s.id); }}
                          className="text-white/20 hover:text-red-400 transition-colors p-1 rounded"
                          title="Delete snapshot"
                        >
                          <Icon name="delete" className="text-base" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default BTMetrics;
