import Icon from '../ui/Icon'
import { getPatchInfo } from '../../lib/constants'

export default function PatchBanner() {
  var p = getPatchInfo()
  if (!p || !p.version) return null
  var dayLabel = p.daysSince === 0 ? 'Live today' : ('Day ' + p.daysSince)
  return (
    <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full border border-secondary/30 bg-secondary/10 text-xs">
      <Icon name="bolt" className="text-secondary" size={14} />
      <span className="font-label uppercase tracking-wide text-secondary">Patch {p.version}</span>
      <span className="text-on-surface-variant">{dayLabel}</span>
    </div>
  )
}
