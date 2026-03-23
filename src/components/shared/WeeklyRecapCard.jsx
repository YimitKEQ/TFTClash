import React from 'react'
import { Panel, Tag, Icon } from '../ui'

function WeeklyRecapCard(props) {
  var players = props.players;
  var pastClashes = props.pastClashes;

  if (!players || players.length === 0) return null;

  var thisWeek = new Date();
  thisWeek.setDate(thisWeek.getDate() - 7);

  var recentClashes = pastClashes
    ? pastClashes.filter(function(c) { return new Date(c.date) >= thisWeek; })
    : [];

  var sorted = players.slice().sort(function(a, b) { return (b.pts || 0) - (a.pts || 0); });
  var top5 = sorted.slice(0, 5);

  var totalGames = players.reduce(function(acc, p) { return acc + (p.games || 0); }, 0);
  var totalWins = players.reduce(function(acc, p) { return acc + (p.wins || 0); }, 0);

  if (totalGames === 0) return null;

  return (
    <Panel className="p-5">
      <div className="flex items-center gap-2.5 mb-3.5">
        <Icon name="bar_chart" className="text-lg" />
        <div className="font-bold text-[15px] text-on-surface font-heading">Weekly Recap</div>
        <Tag color="#9B72CF">This Week</Tag>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="inner-box p-3 text-center">
          <div className="font-mono text-xl font-bold text-amber-400">{recentClashes.length}</div>
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">Clashes</div>
        </div>
        <div className="inner-box p-3 text-center">
          <div className="font-mono text-xl font-bold text-tertiary">{totalGames}</div>
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">Games</div>
        </div>
        <div className="inner-box p-3 text-center">
          <div className="font-mono text-xl font-bold text-success">{totalWins}</div>
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">Total Wins</div>
        </div>
      </div>

      <div className="text-xs font-bold text-primary-light mb-2 uppercase tracking-wider">
        Top Performers
      </div>

      {top5.map(function(p, i) {
        return (
          <div
            key={p.id}
            className={
              "flex items-center gap-2.5 py-1.5" +
              (i < 4 ? " border-b border-on-surface/[.04]" : "")
            }
          >
            <span className={"font-mono text-xs font-bold w-[18px] " + (i < 3 ? "text-amber-400" : "text-on-surface-variant")}>
              {i + 1}
            </span>
            <span className="flex-1 text-[13px] text-on-surface font-semibold">{p.name}</span>
            <span className="font-mono text-[13px] font-bold text-amber-400">{p.pts} pts</span>
          </div>
        );
      })}
    </Panel>
  );
}

export default WeeklyRecapCard;
