import { useState } from 'react';
import { Icon } from '../ui';

function AwardCard(props) {
  var award = props.award;
  var onClick = props.onClick;
  var _hover = useState(false);
  var hovered = _hover[0];
  var setHovered = _hover[1];

  return (
    <div
      onClick={onClick}
      onMouseEnter={function() { if (onClick) setHovered(true); }}
      onMouseLeave={function() { setHovered(false); }}
      className="flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200"
      style={{
        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(52,52,60,0.3)',
        border: '1px solid ' + (hovered ? award.color + '66' : 'rgba(80,67,53,0.3)'),
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: award.color + '18',
          border: '1px solid ' + award.color + '44',
        }}
      >
        <Icon name={award.icon} size={20} style={{ color: award.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-technical text-xs uppercase tracking-wider mb-0.5"
          style={{ color: award.color }}
        >
          {award.title}
        </div>
        {award.winner && (
          <div className="font-bold text-sm text-on-surface truncate">{award.winner.name}</div>
        )}
        <div className="text-[10px] text-on-surface/50 mt-0.5">{award.desc}</div>
        {award.winner && award.stat && (
          <div className="font-mono text-xs mt-1" style={{ color: award.color }}>{award.stat}</div>
        )}
      </div>
    </div>
  );
}

export default AwardCard;
