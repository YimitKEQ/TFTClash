import { RCOLS } from '../../lib/constants'

export default function RankBadge({ rank, className = '' }) {
  const color = RCOLS[rank] || '#9AAABF'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-sans uppercase tracking-widest border ${className}`}
      style={{ color, borderColor: `${color}33`, backgroundColor: `${color}1a` }}
    >
      {rank}
    </span>
  )
}
