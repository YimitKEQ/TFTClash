export default function Panel({ children, className = '', accent, glow, glass, ...props }) {
  const base = glass
    ? 'glass-panel border border-outline-variant/10'
    : 'bg-surface-container-low border border-outline-variant/10'
  const accentBorder = accent === 'gold' ? 'border-t-4 border-t-primary'
    : accent === 'purple' ? 'border-t-4 border-t-secondary'
    : accent === 'teal' ? 'border-t-4 border-t-tertiary'
    : ''
  const glowClass = glow ? 'gold-glow' : ''

  return (
    <div className={`${base} ${accentBorder} ${glowClass} rounded-sm p-6 ${className}`} {...props}>
      {children}
    </div>
  )
}
