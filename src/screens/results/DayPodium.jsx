import Icon from '../../components/ui/Icon'

// Top-3 podium for a single clash, fed by day points (dayPts). Mirrors the season
// podium visual on ResultsScreen but is explicitly the day's result. Display order
// is 2nd, 1st, 3rd so the winner sits centered and tallest.
export default function DayPodium(props) {
  var standings = props.standings || []
  var label = props.label || 'Day Result'
  var onPick = props.onPick || function () {}
  if (standings.length < 3) return null

  var top3 = [standings[1], standings[0], standings[2]]

  return (
    <div className="relative overflow-hidden rounded-xl p-6 md:p-8 border border-outline-variant/10 bg-surface-container-low">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex items-center gap-2 mb-5">
        <Icon name="emoji_events" fill size={18} className="text-primary" />
        <h3 className="font-display text-base tracking-wide uppercase">{label}</h3>
      </div>
      <div className="grid grid-cols-3 items-end gap-3 md:gap-5">
        {top3.map(function (p, idx) {
          var actualRank = idx === 0 ? 1 : idx === 1 ? 0 : 2
          var isGold = actualRank === 0
          var isSilver = actualRank === 1
          var barHeight = isGold ? 'h-44 md:h-56' : isSilver ? 'h-32 md:h-40' : 'h-24 md:h-32'
          var avatarSize = isGold ? 'w-20 h-20 md:w-28 md:h-28' : 'w-14 h-14 md:w-20 md:h-20'
          var avatarBorder = isGold
            ? 'border-4 border-primary shadow-[0_0_24px_rgba(255,198,107,0.4)]'
            : isSilver ? 'border-4 border-on-surface/20' : 'border-4 border-on-surface/15'
          var barStyle = isGold
            ? { background: 'linear-gradient(135deg, #FFC66B 0%, #E8A838 100%)' }
            : isSilver
              ? { background: 'linear-gradient(135deg, #E4E1EC 0%, #9D8E7C 100%)' }
              : { background: 'linear-gradient(135deg, #9D8E7C 0%, #504535 100%)' }
          var numColor = isGold ? 'text-on-primary' : 'text-on-surface'
          return (
            <div
              key={p.id || p.name}
              onClick={function () { onPick(p) }}
              className={'flex flex-col items-center cursor-pointer transition-all duration-200 hover:scale-[1.02]' + (isGold ? ' scale-105 z-10' : '')}
            >
              {isGold && (
                <div className="relative mb-1 flex justify-center">
                  <Icon name="workspace_premium" fill size={24} className="text-primary" />
                </div>
              )}
              <div className={'rounded-full mb-3 flex items-center justify-center bg-surface-container-highest shrink-0 ' + avatarSize + ' ' + avatarBorder}>
                <span className={'font-display font-bold opacity-60 ' + (isGold ? 'text-2xl text-primary' : 'text-lg text-medal-silver')}>
                  {p.name ? p.name[0].toUpperCase() : '?'}
                </span>
              </div>
              <div className={'w-full rounded-t-xl flex flex-col items-center justify-between pt-4 pb-4 shadow-2xl ' + barHeight} style={barStyle}>
                <span className={'font-display opacity-40 leading-none ' + numColor + (isGold ? ' text-5xl' : ' text-3xl')}>
                  {actualRank + 1}
                </span>
                <div className="text-center px-2">
                  <p className={'font-label font-bold uppercase truncate w-full ' + (isGold ? 'text-sm md:text-base' : 'text-xs md:text-sm') + ' ' + numColor}>
                    {p.name}
                  </p>
                  <span className={'font-mono font-bold text-xs opacity-80 ' + numColor}>
                    {(p.dayPts || 0) + ' pts'}
                  </span>
                  {p.avgPlacement != null && (
                    <div className={'font-mono text-[10px] mt-0.5 opacity-60 ' + numColor}>
                      {'avg ' + p.avgPlacement}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
