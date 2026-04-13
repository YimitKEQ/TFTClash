import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'

export default function Podium({ players, className = '' }) {
  const navigate = useNavigate()
  if (!players || players.length < 3) return null
  const [first, second, third] = players

  return (
    <section className={`grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-24 px-4 ${className}`}>
      {/* 2nd place */}
      <PodiumSlot player={second} place={2} color="#C0C0C0" barHeight="h-32" avatarSize="w-32 h-32" imgClass="grayscale opacity-80" order="order-2 md:order-1" navigate={navigate} />
      {/* 1st place */}
      <PodiumSlot player={first} place={1} color="#FFC66B" barHeight="h-48" avatarSize="w-48 h-48" imgClass="" order="order-1 md:order-2" isFirst navigate={navigate} />
      {/* 3rd place */}
      <PodiumSlot player={third} place={3} color="#CD7F32" barHeight="h-24" avatarSize="w-32 h-32" imgClass="sepia-[.3]" order="order-3" navigate={navigate} />
    </section>
  )
}

function PodiumSlot({ player, place, color, barHeight, avatarSize, imgClass, order, isFirst, navigate }) {
  const placeSuffix = place === 1 ? 'ST' : place === 2 ? 'ND' : 'RD'
  return (
    <div className={`${order} flex flex-col items-center ${isFirst ? '-translate-y-8' : ''}`}>
      <div className="relative group cursor-pointer mb-6" onClick={() => navigate(`/player/${player.name}`)}>
        <div
          className={`${avatarSize} rounded-full border-4 overflow-hidden bg-surface-container-high transition-transform duration-300 group-hover:scale-105 ${isFirst ? 'gold-glow' : ''}`}
          style={{ borderColor: isFirst ? undefined : `${color}4d` }}
        >
          <div className={`w-full h-full flex items-center justify-center font-display text-2xl text-on-surface/40 ${imgClass}`}>
            {player.name?.[0]}
          </div>
        </div>
        {isFirst && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <Icon name="workspace_premium" fill size={40} className="text-primary" />
          </div>
        )}
        <div
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 font-display px-3 py-1 rounded text-xs ${
            isFirst
              ? 'bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2 text-lg shadow-xl -bottom-4'
              : 'text-surface'
          }`}
          style={!isFirst ? { backgroundColor: color } : {}}
        >
          {isFirst ? player.name : `${place}${placeSuffix}`}
        </div>
      </div>
      <h3 className={`font-headline ${isFirst ? 'text-3xl' : 'text-2xl'} mb-1`}>{player.name}</h3>
      <p className={`font-mono ${isFirst ? 'text-primary text-lg font-bold' : 'text-tertiary text-sm'}`}>{player.pts || 0} pts</p>
      <div
        className={`${isFirst ? 'mt-6' : 'mt-4'} ${barHeight} w-full rounded-t-xl ${
          isFirst
            ? 'bg-gradient-to-b from-primary/10 to-surface-container-low'
            : 'bg-surface-container-low'
        } ${!isFirst ? (place === 2 ? 'opacity-40' : 'opacity-30') : ''}`}
      />
    </div>
  )
}
