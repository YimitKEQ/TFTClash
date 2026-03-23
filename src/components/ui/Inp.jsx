export default function Inp({ label, icon, className = '', ...props }) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="font-sans text-xs uppercase tracking-widest text-on-surface/70 block ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          className={`w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 py-4 px-4 rounded-none text-on-surface placeholder:text-on-surface/20 focus:ring-1 focus:ring-primary focus:border-primary transition-colors ${className}`}
          {...props}
        />
        {icon && (
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface/20">
            {icon}
          </span>
        )}
      </div>
    </div>
  )
}
