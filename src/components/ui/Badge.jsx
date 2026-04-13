const badgeVariants = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-secondary/10 text-secondary border-secondary/20',
  tertiary: 'bg-tertiary/10 text-tertiary border-tertiary/20',
  error: 'bg-error/10 text-error border-error/20',
  success: 'bg-success/10 text-success border-success/20',
}

export default function Badge({ children, variant = 'primary', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-sans uppercase tracking-widest border ${badgeVariants[variant] || badgeVariants.primary} ${className}`}>
      {children}
    </span>
  )
}
