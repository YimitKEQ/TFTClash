import { useState, useEffect } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Icon } from '../components/ui'
import { supabase } from '../lib/supabase'

// ─── LOCAL SELECT WRAPPER ────────────────────────────────────────────────────
function Sel(props) {
  return (
    <select
      value={props.value}
      onChange={props.onChange}
      className="bg-surface-container border border-outline-variant/30 text-on-surface text-xs font-label rounded px-2 py-1.5 focus:outline-none cursor-pointer"
    >
      {props.children}
    </select>
  );
}

// ─── SKELETON ────────────────────────────────────────────────────────────────
function Skeleton(props) {
  return <div className={'bg-surface-variant/30 animate-pulse rounded-lg ' + (props.className || '')} />;
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
function Empty(props) {
  return (
    <div className="py-10 text-center text-on-surface/30 text-xs font-label uppercase tracking-widest">
      <Icon name="sports_esports" size={32} className="opacity-20 mb-3 mx-auto block" />
      {props.message || 'No data yet - play some clashes!'}
    </div>
  );
}

// ─── SCORE PILL ──────────────────────────────────────────────────────────────
function ScorePill(props) {
  var v = parseFloat(props.value);
  var cls = v >= 80 ? 'bg-success/15 text-success border-success/30'
           : v >= 60 ? 'bg-primary/15 text-primary border-primary/30'
           : v >= 40 ? 'bg-secondary/15 text-secondary border-secondary/30'
           : 'bg-error/15 text-error border-error/30';
  return (
    <span className={'text-[11px] font-mono px-2 py-0.5 rounded border ' + cls}>
      {v.toFixed(1) + (props.suffix || '')}
    </span>
  );
}

// ─── SPOTLIGHT CARDS ─────────────────────────────────────────────────────────
function SpotlightCards(props) {
  var consistency = props.consistency;
  var h2h = props.h2h;
  var gameResults = props.gameResults;
  var loading = props.loading;

  if (loading || !consistency || !h2h || !gameResults) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[0,1,2,3].map(function(i) { return <Skeleton key={i} className="h-24" />; })}
      </div>
    );
  }
  if (consistency.length === 0) return null;

  // Build player lookup from consistency data
  var playerMap = {};
  consistency.forEach(function(p) { playerMap[p.player_id] = p.username; });

  // Most consistent player
  var mostConsistent = consistency.reduce(function(best, p) {
    return (!best || parseFloat(p.consistency_score) > parseFloat(best.consistency_score)) ? p : best;
  }, null);

  // Biggest rivalry
  var biggestRivalry = h2h.reduce(function(best, r) {
    return (!best || r.meetings > best.meetings) ? r : best;
  }, null);

  // Hottest streak - longest consecutive top-4 run per player
  var playerStreaks = {};
  gameResults.forEach(function(gr) {
    var pid = gr.player_id;
    if (!playerStreaks[pid]) playerStreaks[pid] = { results: [] };
    playerStreaks[pid].results.push({ tid: gr.tournament_id || '', placement: gr.placement });
  });

  var hottestPlayer = null;
  var hottestStreak = 0;
  var hottestTop4Rate = 0;
  Object.keys(playerStreaks).forEach(function(pid) {
    var sorted = playerStreaks[pid].results.slice().sort(function(a, b) {
      return a.tid < b.tid ? -1 : a.tid > b.tid ? 1 : 0;
    });
    var cur = 0;
    var best = 0;
    sorted.forEach(function(r) {
      if (r.placement <= 4) { cur++; if (cur > best) best = cur; }
      else cur = 0;
    });
    var pStats = consistency.find(function(p) { return p.player_id === pid; });
    var top4Rate = pStats ? parseFloat(pStats.top4_rate) : 0;
    if (
      best > hottestStreak ||
      (best === hottestStreak && top4Rate > hottestTop4Rate)
    ) {
      hottestStreak = best;
      hottestTop4Rate = top4Rate;
      hottestPlayer = playerMap[pid] || pid;
    }
  });

  // Clutch king
  var clutchKing = consistency.reduce(function(best, p) {
    return (!best || parseFloat(p.clutch_factor) > parseFloat(best.clutch_factor)) ? p : best;
  }, null);

  var cards = [
    {
      icon: 'emoji_events',
      label: 'Most Consistent',
      value: mostConsistent ? mostConsistent.username : '-',
      sub: mostConsistent ? ('Score ' + parseFloat(mostConsistent.consistency_score).toFixed(0)) : '',
      colorClass: 'border-primary/20 bg-primary/5',
      iconClass: 'text-primary',
    },
    {
      icon: 'swords',
      label: 'Biggest Rivalry',
      value: biggestRivalry ? (biggestRivalry.player_a_name + ' vs ' + biggestRivalry.player_b_name) : '-',
      sub: biggestRivalry ? (biggestRivalry.meetings + ' meetings') : '',
      colorClass: 'border-secondary/20 bg-secondary/5',
      iconClass: 'text-secondary',
    },
    {
      icon: 'local_fire_department',
      label: 'Hottest Streak',
      value: hottestPlayer || '-',
      sub: hottestPlayer ? (hottestStreak + ' top-4s in a row') : '',
      colorClass: 'border-error/20 bg-error/5',
      iconClass: 'text-error',
    },
    {
      icon: 'psychology',
      label: 'Clutch King',
      value: clutchKing ? clutchKing.username : '-',
      sub: clutchKing ? (parseFloat(clutchKing.clutch_factor).toFixed(1) + '% clutch') : '',
      colorClass: 'border-success/20 bg-success/5',
      iconClass: 'text-success',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map(function(c, i) {
        return (
          <div key={i} className={'rounded-lg border p-4 ' + c.colorClass}>
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-label uppercase tracking-widest text-on-surface/50">{c.label}</span>
              <Icon name={c.icon} size={16} className={c.iconClass + ' opacity-70'} />
            </div>
            <div className="font-display text-on-surface text-base font-bold leading-tight mb-1 truncate">{c.value}</div>
            <div className="text-[11px] text-on-surface/50">{c.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── H2H PANEL ───────────────────────────────────────────────────────────────
function H2HPanel(props) {
  var h2h = props.h2h;
  var consistency = props.consistency;
  var loading = props.loading;

  var _sel = useState('');
  var sel = _sel[0];
  var setSel = _sel[1];

  var _showAll = useState(false);
  var showAll = _showAll[0];
  var setShowAll = _showAll[1];

  var _search = useState('');
  var search = _search[0];
  var setSearch = _search[1];

  var _searchOpen = useState(false);
  var searchOpen = _searchOpen[0];
  var setSearchOpen = _searchOpen[1];

  if (loading) return <Skeleton className="h-64 mb-6" />;
  if (!h2h || !consistency) return null;

  var playerCount = consistency.length;
  var useSearch = playerCount >= 20;
  var players = consistency.map(function(p) { return { id: p.player_id, name: p.username }; });

  var filteredPlayers = useSearch && search.length > 0
    ? players.filter(function(p) { return p.name.toLowerCase().indexOf(search.toLowerCase()) !== -1; })
    : players;

  var matchups = sel ? h2h.filter(function(r) {
    return r.player_a_id === sel || r.player_b_id === sel;
  }).map(function(r) {
    var isA = r.player_a_id === sel;
    return {
      opponent: isA ? r.player_b_name : r.player_a_name,
      meetings: parseInt(r.meetings),
      wins: parseInt(isA ? r.player_a_wins : r.player_b_wins),
      losses: parseInt(isA ? r.player_b_wins : r.player_a_wins),
      avgPlace: parseFloat(isA ? r.player_a_avg_placement : r.player_b_avg_placement),
    };
  }).sort(function(a, b) { return b.meetings - a.meetings; }) : [];

  var shown = showAll ? matchups : matchups.slice(0, 8);

  return (
    <Panel className="mb-6 p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon name="swords" size={16} className="text-primary" />
          <span className="font-label text-xs uppercase tracking-widest text-on-surface/70">Head-to-Head</span>
        </div>
        <div className="relative">
          {useSearch ? (
            <div className="relative">
              <input
                type="text"
                placeholder="Search player..."
                value={search}
                onChange={function(e) {
                  setSearch(e.target.value);
                  setSel('');
                  setShowAll(false);
                  setSearchOpen(true);
                }}
                onFocus={function() { setSearchOpen(true); }}
                className="bg-surface-container border border-outline-variant/30 text-on-surface text-xs rounded px-2 py-1.5 focus:outline-none w-44"
              />
              {searchOpen && search.length > 0 && !sel && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-surface-container border border-outline-variant/30 rounded shadow-lg z-10 max-h-40 overflow-y-auto">
                  {filteredPlayers.slice(0, 8).map(function(p) {
                    return (
                      <button key={p.id}
                        onClick={function() { setSel(p.id); setSearch(p.name); setSearchOpen(false); setShowAll(false); }}
                        className="w-full text-left px-3 py-2 text-xs text-on-surface/70 hover:bg-white/5 border-none bg-transparent cursor-pointer">
                        {p.name}
                      </button>
                    );
                  })}
                  {filteredPlayers.length === 0 && (
                    <div className="px-3 py-2 text-xs text-on-surface/30">No match</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Sel value={sel} onChange={function(e) { setSel(e.target.value); setShowAll(false); }}>
              <option value="">Select player...</option>
              {players.map(function(p) { return <option key={p.id} value={p.id}>{p.name}</option>; })}
            </Sel>
          )}
        </div>
      </div>

      <div className="p-4">
        {!sel ? (
          <Empty message="Select a player to see their head-to-head record" />
        ) : matchups.length === 0 ? (
          <Empty message="No head-to-head data yet - play some clashes!" />
        ) : (
          <>
            <div className="grid grid-cols-[1fr_56px_80px_80px] gap-2 px-2 pb-2 mb-1 border-b border-white/[0.04]">
              {['Opponent', 'Games', 'Record', 'Avg'].map(function(h) {
                return <span key={h} className={'text-[10px] font-label uppercase tracking-widest text-on-surface/30' + (h !== 'Opponent' ? ' text-center' : '')}>{h}</span>;
              })}
            </div>
            {shown.map(function(r, i) {
              var isWinning = r.wins > r.losses;
              var isLosing = r.losses > r.wins;
              return (
                <div key={i} className="grid grid-cols-[1fr_56px_80px_80px] gap-2 px-2 py-2.5 border-b border-white/[0.03] last:border-0 items-center">
                  <span className="text-sm font-label font-semibold text-on-surface truncate">{r.opponent}</span>
                  <span className="text-xs font-mono text-on-surface/50 text-center">{r.meetings}</span>
                  <span className={'text-xs font-mono text-center font-bold ' + (isWinning ? 'text-success' : isLosing ? 'text-error' : 'text-on-surface/50')}>
                    {r.wins + 'W ' + r.losses + 'L'}
                  </span>
                  <span className="text-xs font-mono text-on-surface/60 text-center">{r.avgPlace.toFixed(2)}</span>
                </div>
              );
            })}
            {matchups.length > 8 && !showAll && (
              <button
                onClick={function() { setShowAll(true); }}
                className="w-full mt-3 py-2 text-xs font-label uppercase tracking-widest text-primary/60 hover:text-primary border-none bg-transparent cursor-pointer transition-colors"
              >
                Show all {matchups.length} opponents
              </button>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

// ─── RANKINGS TABLE BODY RENDERER ─────────────────────────────────────────────
function renderRankingsBody(data, page, PER_PAGE, scoreKey, scoreSuffix, scoreLabel, setPage) {
  var total = data.length;
  var pages = Math.ceil(total / PER_PAGE);
  var start = page * PER_PAGE;
  var slice = data.slice(start, start + PER_PAGE);
  return (
    <div className="p-4">
      <div className="grid grid-cols-[28px_1fr_44px_44px_72px] gap-2 px-2 pb-2 mb-1 border-b border-white/[0.04]">
        {['#', 'Player', 'GP', 'Avg', scoreLabel].map(function(h, i) {
          return <span key={h} className={'text-[10px] font-label uppercase tracking-widest text-on-surface/30' + (i >= 2 ? ' text-center' : '')}>{h}</span>;
        })}
      </div>
      {slice.map(function(p, i) {
        var rank = start + i + 1;
        var val = parseFloat(p[scoreKey] || 0);
        return (
          <div key={p.player_id} className="grid grid-cols-[28px_1fr_44px_44px_72px] gap-2 px-2 py-2.5 border-b border-white/[0.03] last:border-0 items-center">
            <span className="text-[10px] font-mono text-on-surface/30">{'#' + rank}</span>
            <span className="text-sm font-label font-semibold text-on-surface truncate">{p.username}</span>
            <span className="text-xs font-mono text-on-surface/50 text-center">{p.games_played}</span>
            <span className="text-xs font-mono text-on-surface/50 text-center">{parseFloat(p.avg_placement).toFixed(1)}</span>
            <div className="flex justify-center">
              <ScorePill value={val} suffix={scoreSuffix} />
            </div>
          </div>
        );
      })}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
          <button
            onClick={function() { setPage(function(p) { return Math.max(0, p - 1); }); }}
            disabled={page === 0}
            className="text-xs font-label uppercase tracking-widest text-on-surface/40 hover:text-on-surface disabled:opacity-20 border-none bg-transparent cursor-pointer transition-colors"
          >Prev</button>
          <span className="text-[11px] font-mono text-on-surface/30">{(page + 1) + ' / ' + pages}</span>
          <button
            onClick={function() { setPage(function(p) { return Math.min(pages - 1, p + 1); }); }}
            disabled={page === pages - 1}
            className="text-xs font-label uppercase tracking-widest text-on-surface/40 hover:text-on-surface disabled:opacity-20 border-none bg-transparent cursor-pointer transition-colors"
          >Next</button>
        </div>
      )}
    </div>
  );
}

// ─── RANKINGS TABLE ───────────────────────────────────────────────────────────
function RankingsTable(props) {
  var title = props.title;
  var icon = props.icon;
  var data = props.data;
  var loading = props.loading;
  var scoreKey = props.scoreKey;
  var scoreSuffix = props.scoreSuffix || '';
  var scoreLabel = props.scoreLabel;

  var _page = useState(0);
  var page = _page[0];
  var setPage = _page[1];

  var PER_PAGE = 10;

  if (loading) return <Skeleton className="h-80" />;

  return (
    <Panel className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <Icon name={icon} size={16} className="text-primary" />
        <span className="font-label text-xs uppercase tracking-widest text-on-surface/70">{title}</span>
      </div>
      {(!data || data.length === 0) ? (
        <div className="p-4"><Empty /></div>
      ) : renderRankingsBody(data, page, PER_PAGE, scoreKey, scoreSuffix, scoreLabel, setPage)}
    </Panel>
  );
}

// ─── PLACEMENT HEATMAP ────────────────────────────────────────────────────────
function PlacementHeatmap(props) {
  var consistency = props.consistency;
  var gameResults = props.gameResults;
  var loading = props.loading;

  var _page = useState(0);
  var page = _page[0];
  var setPage = _page[1];

  if (loading) return <Skeleton className="h-64 mb-6" />;
  if (!consistency || consistency.length === 0) return null;

  var sorted = consistency.slice().sort(function(a, b) { return b.games_played - a.games_played; });

  // Build placement counts per player
  var placementMap = {};
  (gameResults || []).forEach(function(gr) {
    var pid = gr.player_id;
    var p = parseInt(gr.placement);
    if (p < 1 || p > 8) return;
    if (!placementMap[pid]) placementMap[pid] = { total: 0 };
    placementMap[pid][p] = (placementMap[pid][p] || 0) + 1;
    placementMap[pid].total++;
  });

  function cellPct(pid, placement) {
    var map = placementMap[pid];
    if (!map || !map.total) return 0;
    return ((map[placement] || 0) / map.total);
  }

  // Mobile list
  var mobileList = sorted.slice(0, 10);

  // Desktop paginated grid
  var PER_PAGE = 20;
  var total = sorted.length;
  var pages = Math.ceil(total / PER_PAGE);
  var start = page * PER_PAGE;
  var slice = sorted.slice(start, start + PER_PAGE);

  return (
    <Panel className="mb-6 p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <Icon name="grid_view" size={16} className="text-primary" />
        <span className="font-label text-xs uppercase tracking-widest text-on-surface/70">Placement Heatmap</span>
      </div>

      {/* Mobile: simple list */}
      <div className="block md:hidden p-4">
        <div className="text-[10px] font-label uppercase tracking-widest text-on-surface/30 mb-3">Top 10 by Games Played</div>
        {mobileList.map(function(p, i) {
          return (
            <div key={p.player_id} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
              <span className="text-sm font-label font-semibold text-on-surface">
                {'#' + (i + 1) + ' ' + p.username}
              </span>
              <span className="text-xs font-mono text-on-surface/50">{p.games_played + ' games, avg ' + parseFloat(p.avg_placement).toFixed(1)}</span>
            </div>
          );
        })}
      </div>

      {/* Desktop: full grid */}
      <div className="hidden md:block p-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left font-label text-[10px] uppercase tracking-widest text-on-surface/30 pb-2 pr-3 w-32 font-normal">Player</th>
              {[1,2,3,4,5,6,7,8].map(function(n) {
                return (
                  <th key={n} className="font-label text-[10px] uppercase tracking-widest text-on-surface/30 pb-2 w-12 text-center font-normal">
                    {'#' + n}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.map(function(p) {
              return (
                <tr key={p.player_id} className="border-b border-white/[0.03] last:border-0">
                  <td className="font-label font-semibold text-on-surface/80 py-1.5 pr-3 truncate max-w-[128px]">{p.username}</td>
                  {[1,2,3,4,5,6,7,8].map(function(n) {
                    var opacity = cellPct(p.player_id, n);
                    var pctLabel = Math.round(opacity * 100);
                    return (
                      <td key={n} className="py-1.5 text-center">
                        <div
                          className="w-10 h-7 rounded mx-auto flex items-center justify-center font-mono cursor-default transition-colors"
                          style={{ backgroundColor: 'rgba(155,114,207,' + (opacity * 0.85) + ')' }}
                          title={p.username + ' place #' + n + ': ' + pctLabel + '%'}
                        >
                          {pctLabel > 0 && (
                            <span className="text-[10px] text-white/70">{pctLabel + '%'}</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {pages > 1 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
            <button
              onClick={function() { setPage(function(p) { return Math.max(0, p - 1); }); }}
              disabled={page === 0}
              className="text-xs font-label uppercase tracking-widest text-on-surface/40 hover:text-on-surface disabled:opacity-20 border-none bg-transparent cursor-pointer transition-colors"
            >Prev 20</button>
            <span className="text-[11px] font-mono text-on-surface/30">{(page + 1) + ' / ' + pages}</span>
            <button
              onClick={function() { setPage(function(p) { return Math.min(pages - 1, p + 1); }); }}
              disabled={page === pages - 1}
              className="text-xs font-label uppercase tracking-widest text-on-surface/40 hover:text-on-surface disabled:opacity-20 border-none bg-transparent cursor-pointer transition-colors"
            >Next 20</button>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─── TOP RIVALRIES ────────────────────────────────────────────────────────────
function TopRivalries(props) {
  var h2h = props.h2h;
  var loading = props.loading;

  if (loading) return <Skeleton className="h-64" />;

  var top10 = (!h2h || h2h.length === 0) ? [] :
    h2h.slice().sort(function(a, b) { return b.meetings - a.meetings; }).slice(0, 10);

  return (
    <Panel className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <Icon name="whatshot" size={16} className="text-primary" />
        <span className="font-label text-xs uppercase tracking-widest text-on-surface/70">Top Rivalries</span>
      </div>
      <div className="p-4">
        {top10.length === 0 ? <Empty /> : top10.map(function(r, i) {
          var aW = parseInt(r.player_a_wins);
          var bW = parseInt(r.player_b_wins);
          return (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/[0.03] last:border-0">
              <span className="text-[10px] font-mono text-on-surface/20 w-5 shrink-0">{'#' + (i + 1)}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-label font-semibold text-on-surface">
                  {r.player_a_name + ' vs ' + r.player_b_name}
                </span>
              </div>
              <span className="text-xs font-mono text-on-surface/40 shrink-0">{r.meetings + ' games'}</span>
              <span className={'text-[11px] font-mono px-2 py-0.5 rounded border shrink-0 ' +
                (aW !== bW ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white/5 text-on-surface/40 border-white/10')}>
                {aW + ' - ' + bW}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── SEASON TREND ─────────────────────────────────────────────────────────────
function SeasonTrend(props) {
  var gameResults = props.gameResults;
  var tournaments = props.tournaments;
  var consistency = props.consistency;
  var loading = props.loading;

  var _extra = useState('');
  var extra = _extra[0];
  var setExtra = _extra[1];

  if (loading) return <Skeleton className="h-64" />;
  if (!gameResults || !tournaments || !consistency || gameResults.length === 0) {
    return (
      <Panel className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
          <Icon name="trending_up" size={16} className="text-primary" />
          <span className="font-label text-xs uppercase tracking-widest text-on-surface/70">Season Trend</span>
        </div>
        <div className="p-4"><Empty /></div>
      </Panel>
    );
  }

  var sortedTournaments = tournaments.slice().sort(function(a, b) {
    return a.created_at < b.created_at ? -1 : 1;
  });
  var tids = sortedTournaments.map(function(t) { return t.id; });

  // Build per-player per-tournament avg placement
  var ptData = {};
  gameResults.forEach(function(gr) {
    var pid = gr.player_id;
    var tid = gr.tournament_id;
    if (!tid) return;
    if (!ptData[pid]) ptData[pid] = {};
    if (!ptData[pid][tid]) ptData[pid][tid] = { sum: 0, count: 0 };
    ptData[pid][tid].sum += parseFloat(gr.placement);
    ptData[pid][tid].count++;
  });

  var top5 = consistency.slice().sort(function(a, b) { return b.games_played - a.games_played; }).slice(0, 5);
  var top5ids = top5.map(function(p) { return p.player_id; });
  var remaining = consistency.filter(function(p) { return top5ids.indexOf(p.player_id) === -1; });

  var showPlayers = top5.slice();
  if (extra) {
    var extraPlayer = consistency.find(function(p) { return p.player_id === extra; });
    if (extraPlayer) showPlayers.push(extraPlayer);
  }

  var COLORS = ['#E8A838', '#9B72CF', '#48C774', '#4890C7', '#F14668', '#BECBD9'];
  var SVG_W = 600;
  var SVG_H = 140;

  function buildPath(pid) {
    var pd = ptData[pid];
    if (!pd) return null;
    var points = [];
    tids.forEach(function(tid, i) {
      if (pd[tid] && pd[tid].count > 0) {
        var avg = pd[tid].sum / pd[tid].count;
        var x = tids.length < 2 ? SVG_W / 2 : (i / (tids.length - 1)) * SVG_W;
        var y = ((avg - 1) / 7) * SVG_H;
        points.push(x + ',' + y);
      }
    });
    if (points.length < 2) return null;
    return 'M' + points.join(' L');
  }

  return (
    <Panel className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="trending_up" size={16} className="text-primary" />
          <span className="font-label text-xs uppercase tracking-widest text-on-surface/70">Season Trend</span>
        </div>
        {remaining.length > 0 && (
          <Sel value={extra} onChange={function(e) { setExtra(e.target.value); }}>
            <option value="">+ Add player...</option>
            {remaining.map(function(p) {
              return <option key={p.player_id} value={p.player_id}>{p.username}</option>;
            })}
          </Sel>
        )}
      </div>
      <div className="p-4">
        <div className="flex justify-between text-[10px] font-mono text-on-surface/20 mb-1 px-1">
          <span>1st</span>
          <span className="uppercase tracking-widest">Avg Placement per Tournament</span>
          <span>8th</span>
        </div>
        <div className="w-full overflow-hidden">
          <svg className="w-full" viewBox={'0 0 ' + SVG_W + ' ' + SVG_H} preserveAspectRatio="none" style={{ height: 140 }}>
            {showPlayers.map(function(p, i) {
              var color = COLORS[Math.min(i, COLORS.length - 1)];
              var pathD = buildPath(p.player_id);
              if (!pathD) return null;
              return (
                <path key={p.player_id} d={pathD} fill="none" stroke={color}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
              );
            })}
          </svg>
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {showPlayers.map(function(p, i) {
            var color = COLORS[Math.min(i, COLORS.length - 1)];
            var pd = ptData[p.player_id];
            var hasData = pd && Object.keys(pd).length >= 2;
            return (
              <div key={p.player_id} className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} />
                <span className="text-[11px] font-label text-on-surface/60">{p.username}</span>
                {!hasData && (
                  <span className="text-[10px] text-on-surface/25">(not enough data)</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

// ─── ERROR PANEL ─────────────────────────────────────────────────────────────
function ErrorPanel(props) {
  return (
    <div className="py-20 text-center">
      <Icon name="error_outline" size={40} className="text-error mb-3 mx-auto block" />
      <p className="text-on-surface/50 text-sm mb-4 font-label">{props.message}</p>
      <button
        onClick={props.onRetry}
        className="px-4 py-2 bg-primary/10 border border-primary/20 rounded text-primary text-xs font-label uppercase tracking-widest hover:bg-primary/20 cursor-pointer transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function StatsHubScreen() {
  var _consistency = useState(null);
  var consistency = _consistency[0];
  var setConsistency = _consistency[1];

  var _h2h = useState(null);
  var h2h = _h2h[0];
  var setH2h = _h2h[1];

  var _gameResults = useState(null);
  var gameResults = _gameResults[0];
  var setGameResults = _gameResults[1];

  var _tournaments = useState(null);
  var tournaments = _tournaments[0];
  var setTournaments = _tournaments[1];

  var _loading = useState(true);
  var loading = _loading[0];
  var setLoading = _loading[1];

  var _error = useState(null);
  var error = _error[0];
  var setError = _error[1];

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      supabase.from('player_consistency_stats').select('*').order('consistency_score', { ascending: false }),
      supabase.from('player_h2h_stats').select('*'),
      supabase.from('game_results').select('player_id, placement, tournament_id').gte('placement', 1).lte('placement', 8),
      supabase.from('tournaments').select('id, name, created_at').order('created_at'),
    ]).then(function(results) {
      var cRes = results[0];
      var hRes = results[1];
      var grRes = results[2];
      var tRes = results[3];
      if (cRes.error || hRes.error || grRes.error || tRes.error) {
        setError((cRes.error || hRes.error || grRes.error || tRes.error).message || 'Failed to load stats');
        setLoading(false);
        return;
      }
      setConsistency(cRes.data || []);
      setH2h(hRes.data || []);
      setGameResults(grRes.data || []);
      setTournaments(tRes.data || []);
      setLoading(false);
    }).catch(function(e) {
      setError(e.message || 'Failed to load stats');
      setLoading(false);
    });
  }

  useEffect(function() {
    load();
  }, []);

  var clutchSorted = consistency
    ? consistency.slice().sort(function(a, b) { return parseFloat(b.clutch_factor) - parseFloat(a.clutch_factor); })
    : null;

  return (
    <PageLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-on-surface mb-1">Stats Hub</h1>
        <p className="text-on-surface/40 text-sm font-label">
          {consistency && consistency.length > 0
            ? (consistency.length + ' players with stats')
            : 'Head-to-head records, consistency rankings, and more'}
        </p>
      </div>

      {error ? (
        <ErrorPanel message={error} onRetry={load} />
      ) : (
        <>
          {/* Spotlight */}
          <SpotlightCards consistency={consistency} h2h={h2h} gameResults={gameResults} loading={loading} />

          {/* H2H */}
          <H2HPanel h2h={h2h} consistency={consistency} loading={loading} />

          {/* Rankings row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <RankingsTable
              title="Consistency Rankings"
              icon="bar_chart"
              data={consistency}
              loading={loading}
              scoreKey="consistency_score"
              scoreLabel="Score"
            />
            <RankingsTable
              title="Clutch Factor Rankings"
              icon="psychology"
              data={clutchSorted}
              loading={loading}
              scoreKey="clutch_factor"
              scoreSuffix="%"
              scoreLabel="Clutch %"
            />
          </div>

          {/* Heatmap */}
          <PlacementHeatmap consistency={consistency} gameResults={gameResults} loading={loading} />

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopRivalries h2h={h2h} loading={loading} />
            <SeasonTrend gameResults={gameResults} tournaments={tournaments} consistency={consistency} loading={loading} />
          </div>
        </>
      )}
    </PageLayout>
  );
}
