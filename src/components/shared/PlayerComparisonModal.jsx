import React from 'react'
import { Btn } from '../ui'
import { getStats, computeH2H } from '../../lib/stats'
import Sparkline from './Sparkline'

function PlayerComparisonModal(props) {
  var me = props.playerA;
  var them = props.playerB;
  var players = props.players;
  var onClose = props.onClose;

  if (!me || !them) return null;

  var meStats = getStats(me);
  var themStats = getStats(them);
  var h2h = computeH2H(me, them, props.pastClashes || []);
  var meRank = players.filter(function(p) { return p.pts > me.pts; }).length + 1;
  var themRank = players.filter(function(p) { return p.pts > them.pts; }).length + 1;

  var rows = [
    {label: "Rank", a: "#" + meRank, b: "#" + themRank, better: meRank < themRank ? "a" : meRank > themRank ? "b" : null},
    {label: "Points", a: me.pts, b: them.pts, better: me.pts > them.pts ? "a" : me.pts < them.pts ? "b" : null},
    {label: "Wins", a: me.wins, b: them.wins, better: me.wins > them.wins ? "a" : me.wins < them.wins ? "b" : null},
    {label: "Avg Placement", a: meStats.avgPlacement ? meStats.avgPlacement.toFixed(1) : "-", b: themStats.avgPlacement ? themStats.avgPlacement.toFixed(1) : "-", better: meStats.avgPlacement < themStats.avgPlacement ? "a" : meStats.avgPlacement > themStats.avgPlacement ? "b" : null},
    {label: "Win Rate", a: Math.round(meStats.winRate || 0) + "%", b: Math.round(themStats.winRate || 0) + "%", better: (meStats.winRate || 0) > (themStats.winRate || 0) ? "a" : (meStats.winRate || 0) < (themStats.winRate || 0) ? "b" : null},
    {label: "Top 4 Rate", a: Math.round(meStats.top4Rate || 0) + "%", b: Math.round(themStats.top4Rate || 0) + "%", better: (meStats.top4Rate || 0) > (themStats.top4Rate || 0) ? "a" : (meStats.top4Rate || 0) < (themStats.top4Rate || 0) ? "b" : null}
  ];

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]"
      onClick={onClose}
    >
      <div
        className="bg-surface-container border border-primary/30 rounded-xl p-6 max-w-[480px] w-[90%] max-h-[80vh] overflow-y-auto"
        onClick={function(e) { e.stopPropagation(); }}
      >
        {h2h ? (
          <div className="text-center mb-4">
            <div className="text-[13px] font-bold text-on-surface mb-1">
              {me.name + " vs " + them.name}
            </div>
            <div className="text-[11px] text-primary">
              {h2h.wins + "-" + h2h.losses + " in " + h2h.total + " shared lobbies"}
            </div>
          </div>
        ) : (
          <div className="text-center text-[13px] font-bold text-on-surface mb-4">
            {me.name + " vs " + them.name}
          </div>
        )}

        {rows.map(function(row) {
          return (
            <div
              key={row.label}
              className="grid grid-cols-[1fr_auto_1fr] gap-2 py-2 border-b border-white/[.06] items-center"
            >
              <div
                className={
                  "text-right text-[15px] font-bold rounded-md px-2 py-1 " +
                  (row.better === "a" ? "text-success bg-success/[.08]" : "text-on-surface")
                }
              >
                {row.a}
              </div>
              <div className="text-[10px] text-on-surface-variant uppercase font-semibold text-center min-w-[80px]">
                {row.label}
              </div>
              <div
                className={
                  "text-left text-[15px] font-bold rounded-md px-2 py-1 " +
                  (row.better === "b" ? "text-success bg-success/[.08]" : "text-on-surface")
                }
              >
                {row.b}
              </div>
            </div>
          );
        })}

        <div className="relative h-10 mt-4 mb-2">
          <div className="absolute inset-0">
            <Sparkline
              data={(me.clashHistory || []).slice(-8).map(function(c) { return c.placement || 4; })}
              width={200}
              height={40}
              color="#9B72CF"
            />
          </div>
          <div className="absolute inset-0">
            <Sparkline
              data={(them.clashHistory || []).slice(-8).map(function(c) { return c.placement || 4; })}
              width={200}
              height={40}
              color="#4ECDC4"
            />
          </div>
          <div className="flex gap-3 justify-center mt-0.5">
            <span className="text-[10px] text-primary font-semibold">{me.name}</span>
            <span className="text-[10px] text-tertiary font-semibold">{them.name}</span>
          </div>
        </div>

        <div className="text-center mt-4">
          <Btn v="dark" s="sm" onClick={onClose}>Close</Btn>
        </div>
      </div>
    </div>
  );
}

export default PlayerComparisonModal;
