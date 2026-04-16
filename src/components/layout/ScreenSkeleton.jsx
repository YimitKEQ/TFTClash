export default function ScreenSkeleton(props) {
  var compact = props && props.compact

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={
        'w-full flex items-center justify-center ' +
        (compact ? 'min-h-[40vh]' : 'min-h-[calc(100vh-80px)]')
      }
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-primary/15"></div>
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
        </div>
        <div className="w-40 h-0.5 bg-primary/10 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent tft-skel-scan"></div>
        </div>
        <span className="brand-eyebrow opacity-60">Loading</span>
      </div>
    </div>
  )
}
