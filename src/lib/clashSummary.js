// Pure builder for the per-clash "Day Summary" standings. Ranking is taken from
// the authoritative finalized results (tournament_results.final_placement /
// total_points); game_results is optional and only enriches display columns
// (avg placement, wins, top4). No I/O, no React -- unit tested.

export function buildClashDayStandings(results, players, gameResults) {
  var byId = {};
  (players || []).forEach(function (p) { byId[String(p.id)] = p; });

  var enrich = {};
  (gameResults || []).forEach(function (g) {
    var k = String(g.player_id != null ? g.player_id : g.playerId);
    if (!enrich[k]) enrich[k] = { games: 0, placeSum: 0, wins: 0, top4: 0 };
    var place = g.placement || 0;
    enrich[k].games += 1;
    enrich[k].placeSum += place;
    if (place === 1) enrich[k].wins += 1;
    if (place >= 1 && place <= 4) enrich[k].top4 += 1;
  });

  var rows = (results || []).map(function (r) {
    var key = String(r.player_id);
    var p = byId[key] || {};
    var e = enrich[key];
    var avg = (e && e.games) ? Math.round((e.placeSum / e.games) * 10) / 10 : null;
    return {
      id: r.player_id,
      name: p.name || ('Player ' + r.player_id),
      rank: p.rank || '',
      region: p.region || '',
      placement: (r.final_placement != null ? r.final_placement : null),
      dayPts: r.total_points || 0,
      avgPlacement: avg,
      wins: e ? e.wins : 0,
      top4: e ? e.top4 : 0
    };
  });

  rows.sort(function (a, b) {
    if (a.placement != null && b.placement != null && a.placement !== b.placement) {
      return a.placement - b.placement;
    }
    return (b.dayPts || 0) - (a.dayPts || 0);
  });

  return rows;
}
