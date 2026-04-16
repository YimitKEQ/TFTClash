var VARIANTS = {
  primary:   'bg-primary/10 text-primary border-primary/30',
  secondary: 'bg-secondary/10 text-secondary border-secondary/30',
  tertiary:  'bg-tertiary/10 text-tertiary border-tertiary/30',
  success:   'bg-success/10 text-success border-success/30',
  warning:   'bg-warning/10 text-warning border-warning/30',
  danger:    'bg-error/10 text-error border-error/30',
  gold:      'bg-medal-gold/10 text-medal-gold border-medal-gold/30',
  silver:    'bg-medal-silver/10 text-medal-silver border-medal-silver/30',
  bronze:    'bg-medal-bronze/10 text-medal-bronze border-medal-bronze/30',
  ghost:     'bg-surface-container-low text-on-surface-variant border-outline-variant/30',
}

var SIZES = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
}

export default function Tag({ children, variant, size = 'sm', color, className = '' }) {
  var base = 'inline-flex items-center rounded font-label font-semibold uppercase tracking-widest border'
  var variantClass = variant ? (VARIANTS[variant] || VARIANTS.ghost) : ''
  var sizeClass = SIZES[size] || SIZES.sm

  if (color) {
    return (
      <span
        className={base + ' ' + sizeClass + ' ' + className}
        style={{ color: color, borderColor: color + '33', backgroundColor: color + '1a' }}
      >
        {children}
      </span>
    )
  }

  if (!variant) {
    variantClass = VARIANTS.ghost
  }

  return (
    <span className={base + ' ' + variantClass + ' ' + sizeClass + ' ' + className}>
      {children}
    </span>
  )
}
