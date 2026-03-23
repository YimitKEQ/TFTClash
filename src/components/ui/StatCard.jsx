import Icon from './Icon'

export default function StatCard({ label, value, icon, trend, className = '' }) {
  return (
    <div className={`bg-surface-container-low p-6 rounded-lg relative overflow-hidden group ${className}`}>
      {icon && (
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Icon name={icon} size={48} />
        </div>
      )}
      <span className="font-sans text-on-surface/40 uppercase text-xs tracking-widest mb-4 block">
        {label}
      </span>
      <div className="flex items-end gap-2">
        <span className="font-mono text-3xl font-bold text-on-surface">{value}</span>
        {trend != null && (
          <span className={`font-mono text-sm ${trend > 0 ? 'text-success' : trend < 0 ? 'text-error' : 'text-on-surface/40'}`}>
            {trend > 0 ? '+' : ''}{trend}
          </span>
        )}
      </div>
    </div>
  )
}
