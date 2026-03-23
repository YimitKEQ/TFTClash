export default function Progress({ value = 0, max = 100, className = '' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={`w-full h-2 bg-surface-container-highest rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full bg-gradient-to-r from-primary-container via-primary to-secondary rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
