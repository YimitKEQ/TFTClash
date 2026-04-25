import RankBadge from './RankBadge'

export default function PlayerCard({ player, onClick, className = '' }) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded hover:bg-white/5 transition-colors cursor-pointer ${className}`}
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center font-mono text-sm text-on-surface/60">
        {player.name?.[0] || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm text-on-surface truncate">{player.name}</div>
        <div className="font-mono text-xs text-on-surface/40">{player.pts || 0} pts</div>
      </div>
      <RankBadge rank={player.rank || 'Iron'} />
    </div>
  )
}
