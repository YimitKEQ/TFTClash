import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats, getAchievements, checkAchievements, syncAchievements, ACHIEVEMENTS, isHotStreak, isOnTilt, estimateXp } from '../lib/stats.js'
import { rc, ordinal, avgCol, shareToTwitter, buildShareText } from '../lib/utils.js'
import { RCOLS, RANKS, CLASH_RANKS, getSeasonChampion } from '../lib/constants.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Icon, Badge, Tag, StatCard } from '../components/ui'
import RankBadge from '../components/shared/RankBadge'

// ─── ICON REMAP for Tabler icons ─────────────────────────────────────────────
var ICON_REMAP = {"exclamation-triangle-fill":"alert-triangle","exclamation-octagon-fill":"alert-octagon","info-circle-fill":"info-circle","check-circle-fill":"circle-check","x-circle-fill":"circle-x","slash-circle-fill":"ban","patch-check-fill":"rosette-discount-check","house-fill":"home","search":"search","three-dots":"dots","x-lg":"x","gear-fill":"settings","speedometer2":"gauge","download":"download","inbox":"inbox","clipboard":"clipboard","clipboard-check-fill":"clipboard-check","clipboard-data-fill":"clipboard-data","person-fill":"user","people-fill":"users","person-arms-up":"mood-happy","trophy-fill":"trophy","award-fill":"award","controller":"device-gamepad-2","dice-5-fill":"dice-5","bullseye":"target","crosshair":"crosshair","flag-fill":"flag","fire":"flame","snow":"snowflake","lightning-charge-fill":"bolt","sun-fill":"sun","moon-fill":"moon","water":"droplet-half-2","droplet":"droplet","droplet-fill":"droplet","hexagon-fill":"hexagon","diamond-half":"diamond","gem":"diamond","star-fill":"star","stars":"stars","heart-fill":"heart","shield-fill":"shield","shield-check":"shield-check","coin":"coin","bell-fill":"bell","bell-slash-fill":"bell-off","chat-fill":"message","megaphone-fill":"speakerphone","mic-fill":"microphone","broadcast-pin":"broadcast","calendar-event-fill":"calendar-event","calendar3":"calendar","calendar-check-fill":"calendar-check","bar-chart-line-fill":"chart-bar","graph-up-arrow":"trending-up","diagram-3-fill":"tournament","gift-fill":"gift","lock-fill":"lock","pin-fill":"pin","pencil-fill":"pencil","tag-fill":"tag","building":"building","tv-fill":"device-tv","pc-display":"device-desktop","mouse-fill":"mouse","headphones":"headphones","mortarboard-fill":"school","rocket-takeoff-fill":"rocket","journal-text":"notebook","question-circle-fill":"help-circle","eye-fill":"eye","emoji-dizzy":"mood-sad","pause-fill":"player-pause","archive-fill":"archive","arrow-up-circle-fill":"arrow-up-circle","twitter-x":"brand-x"};

function tablerIcon(name, sizeStyle, colorStyle) {
  var mapped = ICON_REMAP[name] || name;
  return (
    <i
      className={'ti ti-' + mapped}
      style={{ fontSize: sizeStyle || 'inherit', color: colorStyle || 'currentColor', lineHeight: 1, verticalAlign: 'middle' }}
    />
  );
}

// ─── PLACEMENT DISTRIBUTION ───────────────────────────────────────────────────
function PlacementDistribution({ history }) {
  var counts = [0, 0, 0, 0, 0, 0, 0, 0];
  (history || []).forEach(function(g) {
    var p = (g.place || g.placement || 1) - 1;
    if (p >= 0 && p < 8) counts[p]++;
  });
  var total = counts.reduce(function(s, v) { return s + v; }, 0) || 1;
  var colors = ['#E8A838', '#C0C0C0', '#CD7F32', '#4ECDC4', '#9AAABF', '#9AAABF', '#F87171', '#F87171'];

  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest mb-3">Placement Distribution</div>
      {counts.map(function(count, i) {
        var pct = Math.round((count / total) * 100);
        return (
          <div key={i} className="flex items-center gap-3 mb-1.5">
            <div className="font-mono text-xs font-bold w-5 text-right flex-shrink-0" style={{ color: colors[i] }}>
              {i + 1}
            </div>
            <div className="flex-1 h-2 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: pct + '%', backgroundColor: colors[i] }}
              />
            </div>
            <div className="font-mono text-[11px] text-on-surface/50 w-8 flex-shrink-0">{count}x</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── RATE BAR ─────────────────────────────────────────────────────────────────
function RateBar({ label, value, color }) {
  var pct = Math.min(100, parseFloat(value) || 0);
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-on-surface/60">{label}</span>
        <span className="font-mono text-xs font-bold" style={{ color: color }}>{value}</span>
      </div>
      <div className="h-1 rounded-full bg-surface-container-high overflow-hidden">
        <div className="h-full rounded-full" style={{ width: pct + '%', backgroundColor: color, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function PlayerProfileScreen() {
  var params = useParams();
  var navigate = useNavigate();
  var ctx = useApp();
  var players = ctx.players || [];
  var currentUser = ctx.currentUser;
  var seasonConfig = ctx.seasonConfig;
  var setComparePlayer = ctx.setComparePlayer;
  var toast = ctx.toast;

  var player = players.find(function(p) { return p.name === params.name; }) || ctx.profilePlayer;

  var _tab = useState('overview');
  var tab = _tab[0];
  var setTab = _tab[1];

  // Resolve user metadata
  var allUsers = ctx.allUsers || [];
  var userMeta = player ? (player.userMeta || null) : null;
  if (!userMeta && allUsers.length) {
    var mu = allUsers.find(function(u) {
      return player && (u.username === player.name || u.id === player.auth_user_id);
    });
    if (mu) userMeta = mu.user_metadata || null;
  }

  var pBio = player ? (player.bio || (userMeta && userMeta.bio) || '') : '';
  var pTwitch = player ? (player.twitch || (userMeta && userMeta.twitch) || '') : '';
  var pTwitter = player ? (player.twitter || (userMeta && userMeta.twitter) || '') : '';
  var pYoutube = player ? (player.youtube || (userMeta && userMeta.youtube) || '') : '';
  var pPic = player ? (player.profile_pic_url || (userMeta && userMeta.profilePic) || player.profilePic || '') : '';
  var pBanner = player ? ((userMeta && userMeta.bannerUrl) || player.bannerUrl || '') : '';
  var pAccent = player ? ((userMeta && userMeta.profileAccent) || player.profileAccent || '') : '';
  var isOwnProfile = currentUser && player && (currentUser.username === player.name || currentUser.id === player.auth_user_id);

  var achievements = player ? getAchievements(player) : [];
  var s = player ? getStats(player) : { games: 0, wins: 0, top4: 0, bot4: 0, top1Rate: '0.0', top4Rate: '0.0', bot4Rate: '0.0', avgPlacement: '-', perClashAvp: null, roundAvgs: { r1: null, r2: null, r3: null, finals: null }, comebackRate: 0, clutchRate: 0, ppg: 0 };

  // Achievement sync for own profile
  useEffect(function() {
    if (player && player.id && isOwnProfile) {
      var ppRank = players.filter(function(p) { return p.pts > player.pts; }).length + 1;
      var earnedIds = checkAchievements(player, ppRank);
      if (earnedIds.length > 0) syncAchievements(player.id, earnedIds);
    }
  }, [player && player.id]);

  if (!player) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="text-on-surface/30 text-lg">Player not found</div>
          <Btn onClick={function() { navigate(-1); }}>Go Back</Btn>
        </div>
      </PageLayout>
    );
  }

  var rankColor = rc(player.rank);
  var allSorted = players.slice().sort(function(a, b) { return b.pts - a.pts; });
  var seasonRank = allSorted.findIndex(function(p) { return p.id === player.id; }) + 1 || '-';
  var ppg = s.games > 0 ? (player.pts / s.games).toFixed(1) : '0';

  var champion = getSeasonChampion();
  var isChampion = champion && player.name === champion.name;

  function downloadStatsCard() {
    var canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 340;
    var c = canvas.getContext('2d');
    var bg = c.createLinearGradient(0, 0, 600, 340);
    bg.addColorStop(0, '#0A0F1A'); bg.addColorStop(1, '#0D1225');
    c.fillStyle = bg; c.fillRect(0, 0, 600, 340);
    var accent = c.createLinearGradient(0, 0, 600, 0);
    accent.addColorStop(0, 'transparent'); accent.addColorStop(0.4, '#9B72CF'); accent.addColorStop(0.6, '#E8A838'); accent.addColorStop(1, 'transparent');
    c.fillStyle = accent; c.fillRect(0, 0, 600, 3);
    c.fillStyle = 'rgba(155,114,207,0.06)'; c.fillRect(0, 3, 600, 337);
    c.font = 'bold 10px monospace'; c.fillStyle = '#9B72CF';
    c.fillText('TFT CLASH - PLAYER CARD', 24, 30);
    c.font = 'bold 36px serif'; c.fillStyle = '#F2EDE4';
    c.fillText(player.name, 24, 76);
    c.font = 'bold 12px monospace'; c.fillStyle = rankColor;
    c.fillText((player.rank || 'Unranked').toUpperCase() + ' - ' + (player.region || 'EUW'), 24, 100);
    var stats = [['PTS', player.pts, '#E8A838'], ['WINS', s.wins, '#6EE7B7'], ['AVP', s.avgPlacement, '#C4B5FD'], ['TOP4', s.top4, '#4ECDC4'], ['GAMES', s.games, '#F2EDE4'], ['STREAK', player.bestStreak || 0, '#F97316']];
    var cols = 3;
    stats.forEach(function(item, i) {
      var x = 24 + (i % cols) * 186;
      var y = 140 + Math.floor(i / cols) * 90;
      c.fillStyle = 'rgba(255,255,255,0.04)';
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y, 170, 70, 8); else c.rect(x, y, 170, 70);
      c.fill();
      c.font = 'bold 26px monospace'; c.fillStyle = item[2]; c.fillText(String(item[1]), x + 14, y + 42);
      c.font = 'bold 9px monospace'; c.fillStyle = '#9AAABF';
      c.fillText(item[0], x + 14, y + 60);
    });
    c.fillStyle = 'rgba(232,168,56,0.08)'; c.fillRect(0, 308, 600, 32);
    c.font = 'bold 9px monospace'; c.fillStyle = '#E8A838';
    c.fillText('TFTCLASH.GG', 24, 328);
    c.font = '9px monospace'; c.fillStyle = '#BECBD9';
    c.fillText('#TFTClash  #Season1', 480, 328);
    var a = document.createElement('a');
    a.download = player.name + '-stats.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    if (toast) toast('Stats card saved!', 'success');
  }

  function handleShare() {
    var ppRank = players.filter(function(p) { return p.pts > player.pts; }).length + 1;
    shareToTwitter(buildShareText('profile', { name: player.name, rank: ppRank, pts: player.pts }));
  }

  var tabs = ['overview', 'rounds', 'history', 'h2h', 'achievements'];

  return (
    <PageLayout>
      {/* Action Bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Btn onClick={function() { navigate(-1); }}>
          {tablerIcon('arrow-left', 12, null)}
          <span className="ml-1">Back</span>
        </Btn>
        <Btn onClick={function() { navigate('/challenges'); }}>
          {tablerIcon('bolt', 12, null)}
          <span className="ml-1">Challenges</span>
        </Btn>
        <Btn onClick={downloadStatsCard}>
          {tablerIcon('download', 12, null)}
          <span className="ml-1">Download Card</span>
        </Btn>
        <Btn onClick={handleShare}>
          {tablerIcon('brand-x', 12, null)}
          <span className="ml-1">Share</span>
        </Btn>
        {setComparePlayer && !isOwnProfile && (
          <Btn onClick={function() { setComparePlayer(player); }}>
            {tablerIcon('arrows-diff', 12, null)}
            <span className="ml-1">Compare</span>
          </Btn>
        )}
      </div>

      {/* Champion Banner */}
      {isChampion && (
        <div className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: 'linear-gradient(90deg,rgba(232,168,56,.15),rgba(232,168,56,.05))', border: '1px solid rgba(232,168,56,.5)' }}>
          {tablerIcon('trophy', 22, '#E8A838')}
          <div className="flex-1">
            <div className="font-bold text-sm text-[#E8A838]">{champion.title}</div>
            <div className="text-xs text-on-surface/60">Reigning champion since {champion.since}</div>
          </div>
          <Tag color="#E8A838">Season {champion.season}</Tag>
        </div>
      )}

      {/* Hero Banner */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid ' + rankColor + '30' }}>
        {/* Banner area */}
        <div className="h-28 relative overflow-hidden" style={{ background: pBanner ? ('url(' + pBanner + ') center/cover no-repeat') : ('linear-gradient(135deg,' + (pAccent || rankColor) + '28,#08080F 60%)') }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 30%,#08080F)' }} />
        </div>

        <div className="px-6 pb-6" style={{ marginTop: '-36px' }}>
          <div className="flex items-end gap-4 flex-wrap relative">
            {/* Avatar */}
            <div
              className="flex items-center justify-center font-bold flex-shrink-0 text-3xl rounded-full"
              style={{
                width: 80, height: 80,
                background: pPic ? ('url(' + pPic + ') center/cover no-repeat') : ('linear-gradient(135deg,' + rankColor + '33,' + rankColor + '11)'),
                border: '4px solid #08080F',
                boxShadow: '0 0 0 2px ' + (isChampion ? '#E8A838' : rankColor + '66'),
                color: isChampion ? '#E8A838' : rankColor,
                fontFamily: "'Russo One',sans-serif",
                position: 'relative'
              }}
            >
              {isChampion && (
                <span style={{ position: 'absolute', top: -8, right: -8, fontSize: 16 }}>
                  {tablerIcon('trophy', 16, '#E8A838')}
                </span>
              )}
              {!pPic && player.name.charAt(0)}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <h1 className="text-3xl font-serif text-on-surface leading-tight">{player.name}</h1>
                {isChampion && (
                  <Tag color="#E8A838">
                    {tablerIcon('trophy', 11, '#E8A838')}
                    <span className="ml-1">{champion.title}</span>
                  </Tag>
                )}
                {isHotStreak(player) && tablerIcon('flame', 18, '#F97316')}
                {isOnTilt(player) && tablerIcon('mood-sad', 18, '#F87171')}
              </div>

              <div className="flex gap-2 flex-wrap mb-2">
                <RankBadge rank={player.rank} />
                {player.region && <Tag color="#4ECDC4">{player.region}</Tag>}
                {player.riotId && (
                  <span className="font-mono text-xs text-on-surface/40">{player.riotId}</span>
                )}
              </div>

              {/* Top achievements preview */}
              {achievements.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {achievements.slice(0, 4).map(function(a) {
                    return (
                      <div key={a.id} title={a.desc} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(232,168,56,.1)', border: '1px solid rgba(232,168,56,.3)' }}>
                        {tablerIcon(ICON_REMAP[a.icon] || a.icon, 11, null)}
                        <span className="font-bold text-[#E8A838] text-[10px]">{a.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bio + Socials */}
          {(pBio || pTwitch || pTwitter || pYoutube) && (
            <div className="mt-4">
              {pBio && <div className="text-sm text-on-surface/70 leading-relaxed mb-2">{pBio}</div>}
              <div className="flex gap-3 flex-wrap">
                {pTwitch && (
                  <a href={'https://twitch.tv/' + pTwitch} target="_blank" rel="noopener noreferrer" className="text-xs text-primary no-underline flex items-center gap-1 hover:underline">
                    {tablerIcon('brand-twitch', 13, '#9B72CF')}
                    twitch.tv/{pTwitch}
                  </a>
                )}
                {pTwitter && (
                  <a href={'https://x.com/' + pTwitter} target="_blank" rel="noopener noreferrer" className="text-xs text-[#4ECDC4] no-underline flex items-center gap-1 hover:underline">
                    {tablerIcon('brand-x', 13, '#4ECDC4')}
                    @{pTwitter}
                  </a>
                )}
                {pYoutube && (
                  <a href={'https://youtube.com/@' + pYoutube} target="_blank" rel="noopener noreferrer" className="text-xs text-rose-400 no-underline flex items-center gap-1 hover:underline">
                    {tablerIcon('brand-youtube', 13, '#F87171')}
                    youtube.com/@{pYoutube}
                  </a>
                )}
              </div>
            </div>
          )}

          {isOwnProfile && (
            <div className="mt-3">
              <Btn onClick={function() { navigate('/profile'); }}>Edit Profile</Btn>
            </div>
          )}

          {/* Quick stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(232,168,56,.06)', border: '1px solid rgba(232,168,56,.15)' }}>
              <div className="font-mono text-2xl font-bold text-[#E8A838] leading-tight">{player.pts}</div>
              <div className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest mt-1">Season Pts</div>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(110,231,183,.06)', border: '1px solid rgba(110,231,183,.15)' }}>
              <div className="font-mono text-2xl font-bold text-emerald-400 leading-tight">{s.top1Rate + '%'}</div>
              <div className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest mt-1">Win Rate</div>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(78,205,196,.06)', border: '1px solid rgba(78,205,196,.15)' }}>
              <div className="font-mono text-2xl font-bold leading-tight" style={{ color: avgCol(s.avgPlacement) }}>{s.avgPlacement}</div>
              <div className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest mt-1">Avg Place</div>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: 'rgba(196,181,253,.06)', border: '1px solid rgba(196,181,253,.15)' }}>
              <div className="font-mono text-2xl font-bold text-[#C4B5FD] leading-tight">{s.top4Rate + '%'}</div>
              <div className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest mt-1">Top 4 %</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {tabs.map(function(t) {
          var label = t === 'h2h' ? 'H2H' : t === 'rounds' ? 'By Round' : t.charAt(0).toUpperCase() + t.slice(1);
          return (
            <Btn
              key={t}
              onClick={function() { setTab(t); }}
              className="flex-shrink-0 capitalize"
              style={tab === t ? { background: '#9B72CF', color: '#fff' } : {}}
            >
              {label}
            </Btn>
          );
        })}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <PlacementDistribution history={player.clashHistory || []} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Career Stats */}
            <Panel>
              <h3 className="text-sm font-bold text-on-surface mb-4">Career Stats</h3>

              {((player.currentStreak || 0) >= 3 || (player.tiltStreak || 0) >= 3) && (
                <div className="flex gap-2 flex-wrap mb-4">
                  {(player.currentStreak || 0) >= 3 && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#E8A838]" style={{ background: 'rgba(232,168,56,.15)', border: '1px solid rgba(232,168,56,.4)' }}>
                      {tablerIcon('flame', 14, '#F97316')}
                      Hot Streak - {player.currentStreak} wins in a row
                    </div>
                  )}
                  {(player.tiltStreak || 0) >= 3 && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#93C5FD]" style={{ background: 'rgba(96,165,250,.1)', border: '1px solid rgba(96,165,250,.35)' }}>
                      {tablerIcon('snowflake', 14, '#38BDF8')}
                      Cold Streak - {player.tiltStreak} losses
                    </div>
                  )}
                </div>
              )}

              {/* AVP display */}
              <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(232,168,56,.05)', border: '1px solid rgba(232,168,56,.15)' }}>
                <div className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest mb-2">Average Placement</div>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1">
                    <div className="text-xs text-on-surface/60 mb-1">Career AVP</div>
                    <div className="font-mono text-2xl font-bold leading-tight" style={{ color: avgCol(s.avgPlacement) }}>{s.avgPlacement}</div>
                    <div className="text-[10px] text-on-surface/40 mt-1">all games - lower is better</div>
                  </div>
                  {s.perClashAvp && (
                    <div className="flex-1 pl-4 border-l border-on-surface/10">
                      <div className="text-xs text-on-surface/60 mb-1">Per-Clash AVP</div>
                      <div className="font-mono text-2xl font-bold leading-tight" style={{ color: avgCol(s.perClashAvp) }}>{s.perClashAvp}</div>
                      <div className="text-[10px] text-on-surface/40 mt-1">avg within each event</div>
                    </div>
                  )}
                </div>
              </div>

              {[
                ['Games', s.games, '#C8D4E0'],
                ['Wins', s.wins, '#E8A838'],
                ['Top 4', s.top4, '#4ECDC4'],
                ['Bot 4', s.bot4, '#F87171'],
                ['Season Rank', '#' + seasonRank, '#E8A838'],
                ['Consistency', s.games > 0 ? Math.round(s.top4 / s.games * 100) + '%' : '-', '#52C47C'],
                ['PPG', ppg, '#EAB308'],
                ['Best Streak', player.bestStreak || 0, '#EAB308'],
                ['Best Haul', (player.bestHaul || 0) + ' pts', '#E8A838']
              ].map(function(row) {
                return (
                  <div key={row[0]} className="flex justify-between items-center py-2 border-b border-on-surface/5">
                    <span className="text-sm text-on-surface/60">{row[0]}</span>
                    <span className="font-mono text-sm font-bold" style={{ color: row[2] }}>{row[1]}</span>
                  </div>
                );
              })}
            </Panel>

            {/* Rates Panel */}
            <div className="space-y-5">
              <Panel>
                <h3 className="text-sm font-bold text-on-surface mb-4">Rates</h3>
                <RateBar label="Top 1%" value={s.top1Rate + '%'} color="#E8A838" />
                <RateBar label="Top 4%" value={s.top4Rate + '%'} color="#4ECDC4" />
                <RateBar label="Bot 4%" value={s.bot4Rate + '%'} color="#F87171" />
                <RateBar label="Comeback" value={s.comebackRate + '%'} color="#52C47C" />
                <RateBar label="Clutch" value={s.clutchRate + '%'} color="#9B72CF" />
              </Panel>

              {/* Regional rank placeholder */}
              <Panel>
                <h3 className="text-sm font-bold text-on-surface mb-3">Season Standing</h3>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="font-mono text-3xl font-bold text-[#E8A838]">{'#' + seasonRank}</div>
                    <div className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest mt-1">Season Rank</div>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-xs text-on-surface/50">out of {players.length} players</div>
                    {player.region && <div className="text-xs text-on-surface/40 mt-0.5">{player.region} Region</div>}
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )}

      {/* Rounds Tab */}
      {tab === 'rounds' && (
        <Panel>
          <h3 className="text-sm font-bold text-on-surface mb-4">Average Placement By Round</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[['R1', s.roundAvgs.r1, '#4ECDC4'], ['R2', s.roundAvgs.r2, '#9B72CF'], ['R3', s.roundAvgs.r3, '#EAB308'], ['Finals', s.roundAvgs.finals, '#E8A838']].map(function(row) {
              return (
                <div key={row[0]} className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(242,237,228,.07)' }}>
                  <div className="text-[10px] font-bold text-on-surface/40 uppercase tracking-widest mb-2">{row[0]}</div>
                  {row[1]
                    ? (
                      <div>
                        <div className="font-mono text-xl font-bold leading-tight" style={{ color: avgCol(row[1]) }}>{row[1]}</div>
                        <div className="text-[10px] mt-1" style={{ color: avgCol(row[1]) }}>
                          {parseFloat(row[1]) < 3 ? 'Great' : parseFloat(row[1]) < 5 ? 'OK' : 'Rough'}
                        </div>
                      </div>
                    )
                    : <div className="font-mono text-lg text-on-surface/30">-</div>
                  }
                </div>
              );
            })}
          </div>

          <div className="text-xs text-on-surface/50 mb-3">Per-clash round breakdown:</div>
          {(player.clashHistory || []).slice(0, 6).map(function(g, i) {
            return (
              <div key={i} className="grid items-center gap-2 py-2 border-b border-on-surface/5" style={{ gridTemplateColumns: '1fr 50px 50px 50px 50px 50px' }}>
                <div>
                  <div className="font-bold text-sm text-on-surface">{g.name || 'Clash'}</div>
                  <div className="text-xs text-on-surface/40">{g.date || ''}</div>
                </div>
                {['r1', 'r2', 'r3', 'finals'].map(function(rk) {
                  var v = g.roundPlacements ? g.roundPlacements[rk] : null;
                  return (
                    <div key={rk} className="text-center">
                      {v
                        ? <span className="font-mono text-sm font-bold" style={{ color: v === 1 ? '#E8A838' : v <= 4 ? '#4ECDC4' : '#F87171' }}>#{v}</span>
                        : <span className="text-on-surface/30">-</span>
                      }
                    </div>
                  );
                })}
                <div className="font-mono text-sm font-bold text-[#E8A838] text-center">+{g.pts}</div>
              </div>
            );
          })}
        </Panel>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <Panel className="overflow-hidden">
          <div className="px-4 py-3 border-b border-on-surface/10 flex items-center justify-between flex-wrap gap-2" style={{ background: '#0A0F1A' }}>
            <h3 className="text-sm font-bold text-on-surface">Clash History</h3>
            {seasonConfig && seasonConfig.dropWeeks > 0 && (
              <span className="text-xs text-primary">Drop Weeks: {seasonConfig.dropWeeks} worst excluded</span>
            )}
          </div>
          {(player.clashHistory || []).length === 0
            ? (
              <div className="text-center py-10 text-on-surface/40">No history yet</div>
            )
            : (function() {
              var hist = (player.clashHistory || []).slice();
              var dropped = {};
              if (seasonConfig && seasonConfig.dropWeeks > 0) {
                var clashMap = {};
                hist.forEach(function(g) {
                  var cid = g.clashId || 'c0';
                  clashMap[cid] = (clashMap[cid] || 0) + (g.pts || 0);
                });
                var sorted2 = Object.entries(clashMap).sort(function(a, b) { return a[1] - b[1]; });
                sorted2.slice(0, seasonConfig.dropWeeks).forEach(function(e) { dropped[e[0]] = true; });
              }
              return hist.map(function(g, i) {
                var isDropped = dropped[g.clashId || 'c0'];
                var place = g.place || g.placement;
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-on-surface/5" style={{ background: place === 1 ? 'rgba(232,168,56,.03)' : 'transparent', opacity: isDropped ? 0.45 : 1 }}>
                    <div className="font-mono text-xl font-bold min-w-6 text-center" style={{ color: place === 1 ? '#E8A838' : place <= 4 ? '#4ECDC4' : '#BECBD9', textDecoration: isDropped ? 'line-through' : 'none' }}>
                      {place}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-on-surface">{g.name || 'Clash'}</div>
                      <div className="text-xs text-on-surface/40">{g.date || ''}</div>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {g.claimedClutch && <Tag color="#9B72CF" size="sm">Clutch</Tag>}
                        {isDropped && <Tag color="#BECBD9" size="sm">Dropped</Tag>}
                        {g.comebackTriggered && <Tag color="#4ECDC4" size="sm">Comeback +2</Tag>}
                        {g.attendanceMilestone && <Tag color="#E8A838" size="sm">{g.attendanceMilestone}-Streak Bonus</Tag>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-base font-bold" style={{ color: isDropped ? '#BECBD9' : '#E8A838', textDecoration: isDropped ? 'line-through' : 'none' }}>+{g.pts}pts</div>
                      {(g.bonusPts || 0) > 0 && !isDropped && (
                        <div className="font-mono text-xs text-emerald-400">+{g.bonusPts} bonus</div>
                      )}
                      <div className="text-[10px] text-on-surface/40 uppercase font-bold">
                        {place === 1 ? 'Champion' : place <= 4 ? 'Top 4' : 'Bot 4'}
                      </div>
                    </div>
                  </div>
                );
              });
            })()
          }
        </Panel>
      )}

      {/* H2H Tab */}
      {tab === 'h2h' && (
        <div>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-on-surface mb-1">Rivals and Head-to-Head</h3>
            <p className="text-xs text-on-surface/50">Track your record against every player you have shared a lobby with.</p>
          </div>
          {(player.clashHistory || []).length === 0
            ? (
              <div className="text-center py-10 rounded-xl text-on-surface/40" style={{ background: 'rgba(14,22,40,.9)', border: '1px solid rgba(242,237,228,.09)' }}>
                <div className="mb-3">{tablerIcon('tournament', 32, null)}</div>
                <div className="text-sm font-bold text-on-surface/60 mb-1">No H2H data yet</div>
                <div className="text-xs">Compete in a clash to build your rivalry record.</div>
              </div>
            )
            : (
              <Panel className="overflow-hidden">
                <div className="px-4 py-2.5 border-b border-on-surface/10 flex justify-between items-center" style={{ background: '#0A0F1A' }}>
                  <span className="text-xs font-bold text-on-surface/40 uppercase tracking-widest">Shared lobbies</span>
                </div>
                {players.filter(function(op) {
                  return op.id !== player.id && (op.clashHistory || []).some(function(h) {
                    return (player.clashHistory || []).some(function(ph) { return ph.clashId && ph.clashId === h.clashId; });
                  });
                }).map(function(op, i) {
                  var sharedClashes = (player.clashHistory || []).filter(function(h) {
                    return (op.clashHistory || []).some(function(oh) { return oh.clashId && oh.clashId === h.clashId; });
                  });
                  var mW = sharedClashes.filter(function(h) {
                    var oh = (op.clashHistory || []).find(function(x) { return x.clashId === h.clashId; });
                    return oh && (h.place || h.placement) < (oh.place || oh.placement);
                  }).length;
                  var tW = sharedClashes.length - mW;
                  var total = sharedClashes.length || 1;
                  var ahead = mW > tW;
                  var tied = mW === tW;
                  return (
                    <div key={op.id} className="px-4 py-3 border-b border-on-surface/5" style={{ background: i % 2 === 0 ? 'rgba(255,255,255,.01)' : 'transparent' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-1">
                          <div className="font-bold text-sm text-on-surface">{op.name}</div>
                          <div className="text-xs text-on-surface/40">{op.rank} - {op.region} - {sharedClashes.length} shared {sharedClashes.length === 1 ? 'clash' : 'clashes'}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-mono text-sm">
                            <span className="font-bold text-emerald-400">{mW}W</span>
                            <span className="text-on-surface/40 mx-1">-</span>
                            <span className="font-bold text-rose-400">{tW}L</span>
                          </div>
                          <div className="text-[10px] font-bold mt-0.5" style={{ color: ahead ? '#6EE7B7' : tied ? '#E8A838' : '#F87171' }}>
                            {ahead ? "You're ahead" : tied ? 'All tied' : "They're ahead"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-px h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.05)' }}>
                        <div style={{ width: (mW / total * 100) + '%', background: '#6EE7B7', borderRadius: '99px 0 0 99px', transition: 'width .6s' }} />
                        <div style={{ flex: 1, background: 'rgba(248,113,113,.3)', borderRadius: '0 99px 99px 0' }} />
                      </div>
                    </div>
                  );
                })}
              </Panel>
            )
          }
        </div>
      )}

      {/* Achievements Tab */}
      {tab === 'achievements' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACHIEVEMENTS.map(function(a) {
            var unlocked = false;
            try { unlocked = a.check(player); } catch (e) {}
            return (
              <Panel key={a.id} className="p-4" style={{ opacity: unlocked ? 1 : 0.4, border: '1px solid ' + (unlocked ? 'rgba(232,168,56,.3)' : 'rgba(242,237,228,.07)') }}>
                <div className="text-2xl mb-1.5">{tablerIcon(ICON_REMAP[a.icon] || a.icon, 26, null)}</div>
                <div className="font-bold text-sm mb-1" style={{ color: unlocked ? '#F2EDE4' : '#BECBD9' }}>{a.name}</div>
                <div className="text-xs text-on-surface/50 leading-relaxed">{a.desc}</div>
                {unlocked && <div className="mt-2"><Tag color="#E8A838" size="sm">Unlocked</Tag></div>}
              </Panel>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
