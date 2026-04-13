import { Icon, Sel } from '../../components/ui'

// --- Small progress bar ---
function Bar(props) {
  var val = props.val
  var max = props.max
  var color = props.color
  var h = props.h
  var pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
  var height = h || 4;
  return (
    <div className="overflow-hidden bg-white/[0.06]" style={{ height: height, borderRadius: height }}>
      <div className="h-full transition-[width] duration-[400ms]" style={{ width: pct + "%", background: color || "#ffc66b", borderRadius: height }} />
    </div>
  );
}

// --- Status badge pill ---
function StatusPill(props) {
  var status = props.status
  if (status === "live") {
    return (
      <span className="px-2 py-0.5 bg-tertiary-container/10 text-tertiary font-label text-[10px] uppercase tracking-tighter rounded flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-tertiary inline-block" />
        LIVE
      </span>
    );
  }
  if (status === "upcoming" || status === "draft") {
    return <span className="px-2 py-0.5 bg-surface-variant text-slate-300 font-label text-[10px] uppercase tracking-tighter rounded">DRAFT</span>;
  }
  if (status === "pending_approval") {
    return <span className="px-2 py-0.5 bg-primary/10 text-primary font-label text-[10px] uppercase tracking-tighter rounded">PENDING</span>;
  }
  return <span className="px-2 py-0.5 bg-on-background/5 text-slate-500 font-label text-[10px] uppercase tracking-tighter rounded">COMPLETED</span>;
}

var ACCENT_COLORS = ["#ffc66b", "#67e2d9", "#d9b9ff", "#f87171", "#6ee7b7", "#60a5fa", "#fb923c"];

var WIZ_STEPS = ["Basics", "Format", "Branding", "Review"];

export { Sel, Bar, StatusPill, ACCENT_COLORS, WIZ_STEPS }
