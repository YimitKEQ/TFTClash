import { Icon } from '../ui';

function PlacementDistribution(props) {
  var history = props.history;
  var counts = [0, 0, 0, 0, 0, 0, 0, 0];
  (history || []).forEach(function(g) {
    var p = (g.place || g.placement || 1) - 1;
    if (p >= 0 && p < 8) counts[p]++;
  });
  var total = counts.reduce(function(s, v) { return s + v; }, 0) || 1;

  var grouped = [counts[0], counts[1], counts[2], counts[3], counts[4] + counts[5] + counts[6] + counts[7]];
  var labels = ['1ST', '2ND', '3RD', '4TH', '5-8'];
  var bgClasses = [
    'bg-primary',
    'bg-primary-container/60',
    'bg-primary-container/40',
    'bg-primary-container/20',
    'bg-on-surface/5'
  ];
  var labelColors = [
    'text-primary',
    'text-on-surface/60',
    'text-on-surface/60',
    'text-on-surface/60',
    'text-on-surface/20'
  ];
  var maxCount = Math.max.apply(null, grouped) || 1;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest">Placement Distribution</h3>
        <Icon className="text-on-surface/40">info</Icon>
      </div>
      <div className="flex items-end justify-between h-48 gap-2">
        {grouped.map(function(count, i) {
          var pct = Math.round((count / total) * 100);
          var heightPct = Math.round((count / maxCount) * 100);
          return (
            <div key={"place-" + (i + 1)} className="flex flex-col items-center flex-1 group">
              <span className="text-xs font-stats text-on-surface/40 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">{pct + '%'}</span>
              <div className={'w-full rounded-t-sm ' + bgClasses[i]} style={{ height: heightPct + '%', minHeight: count > 0 ? '4px' : '0' }}></div>
              <span className={'font-technical text-[10px] mt-4 ' + labelColors[i]}>{labels[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlacementDistribution;
