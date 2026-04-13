export default function Tag({ children, color, className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-sans uppercase tracking-widest border ${className}`}
      style={color ? { color, borderColor: `${color}33`, backgroundColor: `${color}1a` } : {}}
    >
      {children}
    </span>
  )
}
