var paddings = {
  none: '',
  tight: 'p-4',
  default: 'p-6',
  spacious: 'p-8',
}

var elevations = {
  low: 'bg-surface-container-lowest',
  default: 'bg-surface-container-low',
  elevated: 'bg-surface-container',
  highest: 'bg-surface-container-high',
}

var radii = {
  sm: 'rounded',
  default: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
}

export default function Panel({ children, className = '', padding = 'default', elevation = 'default', radius = 'default', accent, glow, glass, ...props }) {
  var base = glass
    ? 'glass-panel border border-outline-variant/10'
    : (elevations[elevation] || elevations.default) + ' border border-outline-variant/10'
  var accentBorder = accent === 'gold' ? 'border-t-4 border-t-primary'
    : accent === 'purple' ? 'border-t-4 border-t-secondary'
    : accent === 'teal' ? 'border-t-4 border-t-tertiary'
    : ''
  var glowClass = glow ? 'gold-glow' : ''
  var paddingClass = paddings[padding] || paddings.default
  var radiusClass = radii[radius] || radii.default

  return (
    <div className={base + ' ' + accentBorder + ' ' + glowClass + ' ' + radiusClass + ' ' + paddingClass + ' ' + className} {...props}>
      {children}
    </div>
  )
}
