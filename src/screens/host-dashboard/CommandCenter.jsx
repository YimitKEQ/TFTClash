import { Btn, Icon } from '../../components/ui'

// --- Player Pool ---
function PlayerPool(props) {
  var players = props.players || []
  var selectedId = props.selectedId
  var usedIds = props.usedIds || []
  var onSelect = props.onSelect

  return (
    <div className="flex flex-col gap-1">
      <div className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/30 mb-2">Players</div>
      {players.map(function(p) {
        var isUsed = usedIds.indexOf(p.id) > -1
        var isSelected = selectedId === p.id
        return (
          <div
            key={p.id}
            onClick={function() { if (!isUsed) onSelect(p) }}
            className={'flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-sm cursor-pointer transition-colors ' +
              (isSelected ? 'bg-primary/10 border-primary/30 text-primary' :
               isUsed ? 'bg-white/[0.02] border-on-surface/5 text-on-surface/25 cursor-not-allowed' :
               'bg-white/[0.03] border-on-surface/10 text-on-surface/70 hover:border-on-surface/20')}
          >
            <div className="w-5 h-5 rounded-full bg-secondary/20 border border-secondary/30 flex-shrink-0"></div>
            <span className="flex-1 text-xs font-medium">{p.name}</span>
            {isUsed && <Icon name="check_circle" size={12} className="text-secondary/40 flex-shrink-0" />}
          </div>
        )
      })}
    </div>
  )
}

// --- Placement Slots ---
function PlacementSlots(props) {
  var players = props.players || []
  var slots = props.slots || {}
  var selectedPlayerId = props.selectedPlayerId
  var onPlace = props.onPlace

  var rankColors = ['text-primary', 'text-on-surface/50', 'text-tertiary', 'text-on-surface/40', 'text-on-surface/30', 'text-on-surface/30', 'text-on-surface/25', 'text-on-surface/25']

  return (
    <div className="flex flex-col gap-1">
      <div className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/30 mb-2">Click a slot to place</div>
      {[1,2,3,4,5,6,7,8].map(function(rank) {
        var playerId = slots[rank]
        var player = playerId ? players.find(function(p) { return p.id === playerId }) : null
        var isTarget = selectedPlayerId && !playerId
        return (
          <div
            key={rank}
            onClick={function() { onPlace(rank) }}
            className={'flex items-center gap-2 px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors ' +
              (player ? 'bg-surface-container border-on-surface/15' :
               isTarget ? 'bg-primary/[0.06] border-primary/30 border-dashed' :
               'bg-white/[0.02] border-on-surface/8 border-dashed hover:border-on-surface/15')}
          >
            <span className={'cond text-xs font-bold w-5 text-center flex-shrink-0 ' + (rankColors[rank-1] || 'text-on-surface/25')}>{rank}</span>
            {player ? (
              <span className="text-xs text-on-surface/80 flex-1">{player.name}</span>
            ) : (
              <span className={'text-[10px] flex-1 ' + (isTarget ? 'text-primary/60 italic' : 'text-on-surface/20 italic')}>
                {isTarget ? 'click to place' : 'empty'}
              </span>
            )}
            {player && (
              <Icon name="close" size={12} className="text-on-surface/20 hover:text-on-surface/50 flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// --- Lobby Card ---
function LobbyCard(props) {
  var players = props.players || []
  var slots = props.slots || {}
  var selectedPlayerId = props.selectedPlayerId
  var onSelect = props.onSelect
  var onPlace = props.onPlace

  var usedIds = Object.values(slots).filter(Boolean)
  var filledCount = usedIds.length

  return (
    <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-on-surface/8">
        <span className="cond text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface/50">Lobby A - {players.length} players</span>
        <span className="cond text-[9px] font-bold text-secondary">{filledCount}/8 placed</span>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        <PlayerPool players={players} selectedId={selectedPlayerId} usedIds={usedIds} onSelect={onSelect} />
        <PlacementSlots players={players} slots={slots} selectedPlayerId={selectedPlayerId} onPlace={onPlace} />
      </div>
    </div>
  )
}

// --- Round Control ---
function RoundControl(props) {
  var players = props.players || []
  var round = props.round
  var pendingPlacements = props.pendingPlacements || {}
  var selectedPlayer = props.selectedPlayer
  var placementStack = props.placementStack || []
  var onSelect = props.onSelect
  var onPlace = props.onPlace
  var onUndo = props.onUndo
  var onConfirm = props.onConfirm
  var onSaveDraft = props.onSaveDraft

  var filledCount = Object.keys(pendingPlacements).filter(function(k) { return pendingPlacements[k] }).length
  var allFilled = filledCount === 8

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="sports_esports" size={14} className="text-primary" />
          <span className="cond text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface/50">Round Control - Round {round}</span>
        </div>
        <span className="cond text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">Live</span>
      </div>

      <LobbyCard
        players={players}
        slots={pendingPlacements}
        selectedPlayerId={selectedPlayer ? selectedPlayer.id : null}
        onSelect={onSelect}
        onPlace={onPlace}
      />

      <div className="flex items-center gap-2 pt-1">
        <Btn variant="ghost" size="sm" onClick={onUndo} disabled={placementStack.length === 0}>Undo Last</Btn>
        <div className="flex-1"></div>
        <Btn variant="ghost" size="sm" onClick={onSaveDraft}>Save Draft</Btn>
        <Btn variant="secondary" size="sm" onClick={onConfirm} disabled={!allFilled}>
          Confirm Round {round} &rarr;
        </Btn>
      </div>
    </div>
  )
}

export { PlayerPool, PlacementSlots, LobbyCard, RoundControl }
