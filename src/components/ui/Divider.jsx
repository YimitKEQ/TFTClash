export default function Divider({ label }) {
  if (!label) return <div className="border-t border-outline-variant/10" />
  return (
    <div className="relative flex items-center">
      <div className="flex-grow border-t border-outline-variant/20" />
      <span className="px-4 font-sans text-[10px] uppercase tracking-tighter text-on-surface/30">
        {label}
      </span>
      <div className="flex-grow border-t border-outline-variant/20" />
    </div>
  )
}
