import { Icon } from '../ui'

export default function PlacementPicker(props) {
  var slots = Math.max(1, Math.min(16, parseInt(props.slots, 10) || 8))
  var value = parseInt(props.value, 10) || 0
  var onChange = props.onChange
  var disabled = !!props.disabled
  var size = props.size || 'md'
  var label = props.label || ''
  var teamMode = !!props.teamMode

  var tileBase = size === 'sm'
    ? 'h-9 min-w-9 px-2 text-sm'
    : 'h-12 min-w-12 px-2 text-base'
  var ringBase = 'rounded-md border font-display tracking-tight transition-all duration-150 motion-reduce:transition-none flex items-center justify-center select-none'

  function colorFor(n, selected) {
    if (selected) {
      if (n === 1) return 'bg-primary text-on-primary border-primary shadow-md'
      if (n <= 4) return 'bg-tertiary text-on-tertiary border-tertiary shadow-md'
      return 'bg-secondary text-on-secondary border-secondary shadow-md'
    }
    if (n === 1) return 'border-primary/40 text-primary hover:bg-primary/10 bg-surface-container-lowest'
    if (n <= 4) return 'border-tertiary/30 text-tertiary hover:bg-tertiary/10 bg-surface-container-lowest'
    return 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container hover:text-on-surface bg-surface-container-lowest'
  }

  var tiles = []
  for (var i = 1; i <= slots; i++) {
    tiles.push(i)
  }

  return (
    <div className="w-full">
      {label && (
        <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">{label}</div>
      )}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {tiles.map(function(n) {
          var selected = value === n
          return (
            <button
              key={'place-' + n}
              type="button"
              disabled={disabled}
              onClick={function() { if (!disabled && onChange) onChange(n) }}
              aria-pressed={selected}
              aria-label={'Placement ' + n + (teamMode ? ' (team)' : '')}
              className={
                tileBase + ' ' + ringBase + ' ' + colorFor(n, selected) + ' ' +
                (disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60')
              }
            >
              {n === 1 && selected ? (
                <span className="flex items-center gap-1"><Icon name="emoji_events" size={size === 'sm' ? 14 : 16} />{n}</span>
              ) : (
                <span>{n}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
