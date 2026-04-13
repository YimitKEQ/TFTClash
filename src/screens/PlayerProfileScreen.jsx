import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats, getAchievements, checkAchievements, syncAchievements, ACHIEVEMENTS, isHotStreak, isOnTilt } from '../lib/stats.js'
import { rc, ordinal, avgCol, shareToTwitter, buildShareText } from '../lib/utils.js'
import { CLASH_RANKS, getSeasonChampion } from '../lib/constants.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Icon, Badge, Tag, StatCard } from '../components/ui'
import RankBadge from '../components/shared/RankBadge'
import PlacementDistribution from '../components/shared/PlacementDistribution'
import { supabase } from '../lib/supabase'

// ─── RATE BAR ─────────────────────────────────────────────────────────────────
function RateBar({ label, value, color }) {
  var pct = Math.min(100, parseFloat(value) || 0);
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-xs font-technical text-on-surface/60">{label}</span>
        <span className="font-stats text-xs font-bold" style={{ color: color }}>{value}</span>
      </div>
      <div className="h-1 rounded-full bg-surface-container-high overflow-hidden">
        <div className="h-full rounded-t-sm" style={{ width: pct + '%', backgroundColor: color, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

// ─── ORDINAL SUFFIX ───────────────────────────────────────────────────────────
function ordinalSuffix(n) {
  if (n === 1) return 'ST';
  if (n === 2) return 'ND';
  if (n === 3) return 'RD';
  return 'TH';
}

// ─── SPARKLINE SVG ───────────────────────────────────────────────────────────
function renderSparklineSvg(clashHistory) {
  var hist = (clashHistory || []).slice().reverse();
  if (hist.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-on-surface/20 font-technical text-xs uppercase tracking-widest">
        Not enough data
      </div>
    );
  }
  var cumulativePts = [];
  var running = 0;
  hist.forEach(function(g) {
    running += (g.pts || 0);
    cumulativePts.push(running);
  });
  var maxPts = Math.max.apply(null, cumulativePts) || 1;
  var n = cumulativePts.length;
  var points = cumulativePts.map(function(v, i) {
    var x = (i / (n - 1)) * 1000;
    var y = 200 - (v / maxPts) * 180;
    return x + ',' + y;
  });
  var pathD = 'M' + points.join(' L');
  var fillD = pathD + ' V200 H0 Z';
  return (
    <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
      <defs>
        <linearGradient id="line-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffc66b" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffc66b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathD} fill="none" stroke="#ffc66b" strokeWidth="3" strokeLinecap="round" />
      <path d={fillD} fill="url(#line-gradient)" />
    </svg>
  );
}

// ─── CLASH HISTORY ROWS ──────────────────────────────────────────────────────
function renderClashHistoryRows(clashHistory, seasonConfig) {
  var hist = (clashHistory || []).slice();
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
      <div
        key={g.clashId || g.name || ("clash-" + i)}
        className={'flex items-center gap-4 px-6 py-4 border-b border-on-surface/5 hover:bg-surface-container-high transition-all ' + (place === 1 ? 'bg-primary/[0.03]' : '') + (isDropped ? ' opacity-[0.45]' : '')}
      >
        <div
          className={'w-12 h-12 flex flex-col items-center justify-center rounded border flex-shrink-0 ' + (place === 1 ? 'bg-tertiary/10 border-tertiary/20' : 'bg-white/[0.03] border-white/[0.07]')}
        >
          <span className={'font-display text-xl ' + (place === 1 ? 'text-tertiary' : place <= 4 ? 'text-tertiary' : 'text-on-surface-variant') + (isDropped ? ' line-through' : '')}>
            {place}
          </span>
          <span className={'font-technical text-[8px] -mt-1 uppercase ' + (place === 1 ? 'text-tertiary/60' : 'text-white/20')}>
            {typeof place === 'number' ? ordinalSuffix(place) : ''}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-technical font-bold text-sm text-on-surface">{g.name || 'Clash'}</div>
          <div className="font-technical text-xs text-on-surface/40">{g.date || ''}</div>
          <div className="flex gap-1 flex-wrap mt-1">
            {g.claimedClutch && <span className="font-technical text-[10px] px-2 py-0.5 rounded bg-secondary/15 text-secondary-container border border-secondary/30">Clutch</span>}
            {isDropped && <span className="font-technical text-[10px] px-2 py-0.5 rounded bg-on-surface/10 text-on-surface-variant border border-on-surface/20">Dropped</span>}
            {g.comebackTriggered && <span className="font-technical text-[10px] px-2 py-0.5 rounded bg-tertiary/10 text-tertiary border border-tertiary/25">Comeback +2</span>}
            {g.attendanceMilestone && <span className="font-technical text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/25">{g.attendanceMilestone + '-Streak Bonus'}</span>}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={'font-stats text-base font-bold ' + (isDropped ? 'text-on-surface-variant line-through' : 'text-primary')}>
            {'+' + g.pts + 'pts'}
          </div>
          {(g.bonusPts || 0) > 0 && !isDropped && (
            <div className="font-stats text-xs text-emerald-400">{'+' + g.bonusPts + ' bonus'}</div>
          )}
          <div className="font-technical text-[10px] text-on-surface/40 uppercase">
            {place === 1 ? 'Champion' : place <= 4 ? 'Top 4' : 'Bot 4'}
          </div>
        </div>
      </div>
    );
  });
}

// ─── DEEP STATS HELPERS ───────────────────────────────────────────────────────
function renderDeepScoreCards(deepStats, deepGr) {
  var consistency_s = parseFloat(deepStats.consistency_score);
  var clutch_s = parseFloat(deepStats.clutch_factor);
  var stddev_s = parseFloat(deepStats.stddev_placement);
  var last10 = (deepGr || []).slice(-10);
  var last10Avg = last10.length > 0
    ? last10.reduce(function(s, r) { return s + parseFloat(r.placement); }, 0) / last10.length
    : null;
  var formGrade = last10Avg === null ? '-'
    : last10Avg <= 2.0 ? 'A+'
    : last10Avg <= 3.0 ? 'A'
    : last10Avg <= 4.0 ? 'B'
    : last10Avg <= 5.0 ? 'C'
    : 'D';
  var formColor = (formGrade === 'A+' || formGrade === 'A') ? 'text-success'
    : formGrade === 'B' ? 'text-primary'
    : formGrade === 'C' ? 'text-secondary'
    : 'text-error';
  var scoreCards = [
    { label: 'Consistency', value: consistency_s.toFixed(1), suffix: '/100', color: consistency_s >= 80 ? 'text-success' : consistency_s >= 60 ? 'text-primary' : 'text-error' },
    { label: 'Clutch Factor', value: clutch_s.toFixed(1) + '%', suffix: '', color: clutch_s >= 60 ? 'text-success' : clutch_s >= 40 ? 'text-primary' : 'text-error' },
    { label: 'Current Form', value: formGrade, suffix: '', color: formColor },
    { label: 'Volatility (SD)', value: stddev_s.toFixed(2), suffix: '', color: stddev_s <= 1.5 ? 'text-success' : stddev_s <= 2.5 ? 'text-primary' : 'text-error' },
  ];
  return scoreCards.map(function(sc) {
    return (
      <div key={sc.label} className="bg-surface-container p-3 rounded-lg">
        <div className="font-technical text-[10px] uppercase tracking-widest text-on-surface/40 mb-1">{sc.label}</div>
        <div className={'font-display text-xl font-bold ' + sc.color}>{sc.value}<span className="text-sm text-on-surface/30 ml-0.5">{sc.suffix}</span></div>
      </div>
    );
  });
}

function renderDeepPlacementBars(deepGr) {
  var grData = deepGr || [];
  var counts = { 1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0 };
  var total = grData.length || 1;
  grData.forEach(function(r) {
    var p = parseInt(r.placement);
    if (p >= 1 && p <= 8) counts[p]++;
  });
  var barColors = ['#E8A838','#48C774','#48C774','#4890C7','#BECBD9','#BECBD9','#F14668','#F14668'];
  return [1,2,3,4,5,6,7,8].map(function(n) {
    var pct = Math.round((counts[n] / total) * 100);
    var color = barColors[n - 1];
    return (
      <div key={n} className="flex items-center gap-3 mb-2">
        <span className="font-technical text-xs text-on-surface/50 w-6 text-right shrink-0">{'#' + n}</span>
        <div className="flex-1 bg-surface-container-high rounded-full h-2 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: pct + '%', backgroundColor: color }} />
        </div>
        <span className="font-stats text-xs text-on-surface/60 w-8 text-right shrink-0">{pct + '%'}</span>
      </div>
    );
  });
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

  var subRoute = ctx.subRoute || '';
  var urlName = params.name || subRoute;
  var urlPlayer = urlName
    ? players.find(function(p) { return p.name === urlName || p.username === urlName || p.name === decodeURIComponent(urlName) || p.username === decodeURIComponent(urlName); })
    : null;
  var player = urlPlayer || ctx.profilePlayer || null;

  var _tab = useState('overview');
  var tab = _tab[0];
  var setTab = _tab[1];

  // Resolve user metadata from player record only
  var userMeta = player ? (player.userMeta || null) : null;

  var pBio = player ? (player.bio || (userMeta && userMeta.bio) || '') : '';
  var pTwitch = player ? (player.twitch || (userMeta && userMeta.twitch) || '') : '';
  var pTwitterRaw = player ? (player.twitter || (userMeta && userMeta.twitter) || '') : '';
  var pTwitter = pTwitterRaw.charAt(0) === '@' ? pTwitterRaw.slice(1) : pTwitterRaw;
  var pYoutube = player ? (player.youtube || (userMeta && userMeta.youtube) || '') : '';
  var pPic = player ? (player.profile_pic_url || (userMeta && userMeta.profilePic) || player.profilePic || '') : '';
  var pBanner = player ? ((userMeta && userMeta.bannerUrl) || player.bannerUrl || '') : '';
  var pAccent = player ? ((userMeta && userMeta.profileAccent) || player.profileAccent || '') : '';
  var isOwnProfile = currentUser && player && (currentUser.username === player.name || currentUser.id === player.auth_user_id);

  var achievements = player ? getAchievements(player) : [];
  var s = player ? getStats(player) : { games: 0, wins: 0, top4: 0, bot4: 0, top1Rate: '0.0', top4Rate: '0.0', bot4Rate: '0.0', avgPlacement: '-', perClashAvp: null, roundAvgs: { r1: null, r2: null, r3: null, finals: null }, comebackRate: 0, clutchRate: 0, ppg: 0 };

  // Subscription badge
  var _subTier = useState(null);
  var profileSubTier = _subTier[0];
  var setProfileSubTier = _subTier[1];
  useEffect(function() {
    if (!player || !player.auth_user_id) { setProfileSubTier(null); return; }
    supabase.from('user_subscriptions').select('tier, status').eq('user_id', player.auth_user_id).single()
      .then(function(res) {
        if (res.data && res.data.status === 'active' && res.data.tier !== 'free') {
          setProfileSubTier(res.data.tier);
        } else {
          setProfileSubTier(null);
        }
      }).catch(function() { setProfileSubTier(null); });
  }, [player ? player.auth_user_id : null]);

  // Achievement sync for own profile
  useEffect(function() {
    if (player && player.id && isOwnProfile) {
      var ppRank = players.filter(function(p) { return p.pts > player.pts; }).length + 1;
      var earnedIds = checkAchievements(player, ppRank);
      if (earnedIds.length > 0) syncAchievements(player.id, earnedIds);
    }
  }, [player && player.id]);

  // Deep Stats data
  var _deepStats = useState(null);
  var deepStats = _deepStats[0];
  var setDeepStats = _deepStats[1];

  var _deepH2h = useState(null);
  var deepH2h = _deepH2h[0];
  var setDeepH2h = _deepH2h[1];

  var _deepGr = useState(null);
  var deepGr = _deepGr[0];
  var setDeepGr = _deepGr[1];

  var _deepLoading = useState(false);
  var deepLoading = _deepLoading[0];
  var setDeepLoading = _deepLoading[1];

  var _deepError = useState(null);
  var deepError = _deepError[0];
  var setDeepError = _deepError[1];

  useEffect(function() {
    if (tab !== 'deep-stats' || !player || !player.id) return;
    if (deepStats !== null) return; // already loaded
    setDeepLoading(true);
    setDeepError(null);
    Promise.all([
      supabase.from('player_consistency_stats').select('*').eq('player_id', player.id).single(),
      supabase.from('player_h2h_stats').select('*').or('player_a_id.eq.' + player.id + ',player_b_id.eq.' + player.id),
      supabase.from('game_results').select('placement, tournament_id').eq('player_id', player.id).gte('placement', 1).lte('placement', 8).order('tournament_id'),
    ]).then(function(results) {
      var sRes = results[0];
      var hRes = results[1];
      var grRes = results[2];
      if (sRes.error || hRes.error || grRes.error) {
        setDeepError((sRes.error || hRes.error || grRes.error).message || 'Failed to load deep stats');
        setDeepLoading(false);
        return;
      }
      setDeepStats(sRes.data || null);
      setDeepH2h(hRes.data || []);
      setDeepGr(grRes.data || []);
      setDeepLoading(false);
    }).catch(function(e) {
      setDeepError(e.message || 'Failed to load');
      setDeepLoading(false);
    });
  }, [tab, player ? player.id : null]);

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

  var tabs = ['overview', 'rounds', 'history', 'h2h', 'achievements', 'deep-stats'];

  return (
    <PageLayout>
      {/* Hero Banner */}
      <div className="relative h-52 sm:h-72 w-[calc(100%+3rem)] overflow-hidden -mx-6 mb-8">
        <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-primary to-primary-fixed-dim"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
        {pBanner && (
          <img
            src={pBanner}
            alt="Profile Banner"
            className="w-full h-full object-cover mix-blend-overlay opacity-30"
          />
        )}

        {/* Profile Info Overlay */}
        <div className="absolute bottom-0 left-0 w-full px-4 sm:px-6 pb-6 sm:pb-8 flex flex-col md:flex-row items-start md:items-end gap-4 sm:gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="w-32 h-32 md:w-40 md:h-40 border-4 border-primary p-1 rounded-full overflow-hidden relative z-10 flex items-center justify-center font-display font-bold text-4xl"
              style={{
                background: pPic ? ('url(' + pPic + ') center/cover no-repeat') : 'linear-gradient(135deg, #34343c, #1f1f27)',
                boxShadow: '0 0 30px rgba(253, 186, 73, 0.15)',
                color: rankColor,
              }}
            >
              {!pPic && player.name.charAt(0)}
            </div>
            {isChampion && (
              <div className="absolute -bottom-2 right-4 z-20 bg-primary text-on-primary-fixed font-technical font-bold px-3 py-1 rounded-full text-xs tracking-tighter">
                CHAMPION
              </div>
            )}
            {!isChampion && s.games > 0 && (
              <div className="absolute -bottom-2 right-4 z-20 bg-primary text-on-primary-fixed font-technical font-bold px-3 py-1 rounded-full text-xs tracking-tighter">
                {'LVL ' + Math.max(1, s.games)}
              </div>
            )}
          </div>

          <div className="flex-1 mb-2">
            <div className="flex items-center gap-4 mb-1 flex-wrap">
              <h1 className="text-3xl sm:text-5xl font-editorial text-on-surface">{player.name}</h1>
              {player.rank && (
                <div className="bg-tertiary/10 text-tertiary px-3 py-1 rounded font-technical text-xs tracking-widest border border-tertiary/20">
                  {player.rank.toUpperCase()}
                </div>
              )}
              {isChampion && (
                <div className="bg-primary/10 text-primary px-3 py-1 rounded font-technical text-xs tracking-widest border border-primary/20">
                  {champion.title.toUpperCase()}
                </div>
              )}
              {profileSubTier && (function() {
                var badgeLabels = { pro: 'PRO', scrim: 'SCRIM', bundle: 'PRO+SCRIM', host: 'HOST' };
                var isHostTier = profileSubTier === 'host';
                return (
                  <div className={(isHostTier ? 'bg-tertiary/10 text-tertiary border-tertiary/20' : 'bg-primary/10 text-primary border-primary/20') + ' px-3 py-1 rounded font-technical text-xs tracking-widest border flex items-center gap-1.5'}>
                    <Icon name={isHostTier ? 'shield_person' : 'verified'} size={14} fill />
                    {badgeLabels[profileSubTier] || profileSubTier.toUpperCase()}
                  </div>
                );
              })()}
            </div>
            {(player.riot_id_eu || player.riot_id) && (
              <div className="flex items-center gap-2 text-on-surface-variant text-sm mt-1">
                <Icon name="sports_esports" size={16} />
                <span className="font-label">{player.riot_id_eu || player.riot_id}</span>
              </div>
            )}
            {pBio && (
              <p className="text-on-surface/40 font-body text-sm max-w-lg mb-3">{pBio}</p>
            )}
            {!pBio && (
              <p className="text-on-surface/40 font-body text-sm max-w-lg mb-3">
                {'Season ' + (seasonConfig && seasonConfig.season ? seasonConfig.season : '1') + ' competitor.'}
              </p>
            )}
            <div className="flex gap-4 mt-2 flex-wrap">
              <button
                className="flex items-center gap-2 text-on-surface/60 hover:text-primary transition-colors"
                onClick={handleShare}
              >
                <Icon className="text-lg">share</Icon>
                <span className="font-technical text-xs tracking-widest uppercase">Share</span>
              </button>
              {!isOwnProfile && (
                <button
                  className="flex items-center gap-2 text-on-surface/60 hover:text-primary transition-colors"
                  onClick={function() {
                    navigate('/standings');
                    if (toast) toast('View full rankings on the Standings page', 'info');
                  }}
                >
                  <Icon className="text-lg">person_add</Icon>
                  <span className="font-technical text-xs tracking-widest uppercase">Compare</span>
                </button>
              )}
              {isOwnProfile && (
                <button
                  className="flex items-center gap-2 text-on-surface/60 hover:text-primary transition-colors"
                  onClick={function() { navigate('/account'); }}
                >
                  <Icon className="text-lg">edit</Icon>
                  <span className="font-technical text-xs tracking-widest uppercase">Edit Profile</span>
                </button>
              )}
              <button
                className="flex items-center gap-2 text-on-surface/60 hover:text-primary transition-colors"
                onClick={downloadStatsCard}
              >
                <Icon className="text-lg">download</Icon>
                <span className="font-technical text-xs tracking-widest uppercase">Download Card</span>
              </button>
            </div>
          </div>

          {/* Regional Rank */}
          <div className="hidden lg:flex flex-col items-end gap-2 mb-2">
            <span className="font-technical text-on-surface/40 uppercase text-xs tracking-[0.2em]">Regional Rank</span>
            <span className="text-4xl font-display text-primary tracking-tighter">
              {'#' + (seasonRank < 10 ? '0' + seasonRank : seasonRank)}
            </span>
          </div>
        </div>
      </div>

      {/* 4-Column Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {/* Stat 1: Total LP Points */}
        <div className="bg-surface-container-low p-4 sm:p-6 rounded-lg relative overflow-hidden group hover:bg-surface-container transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Icon className="text-6xl">military_tech</Icon>
          </div>
          <span className="font-technical text-on-surface/40 uppercase text-xs tracking-widest mb-3 block">Total Pts</span>
          <div className="flex items-end gap-2 flex-wrap">
            <span className="text-3xl sm:text-4xl font-stats text-on-surface font-bold">{player.pts}</span>
            {ppg > 0 && (
              <span className="text-primary text-sm font-stats mb-1">{'+' + ppg + ' PPG'}</span>
            )}
          </div>
        </div>

        {/* Stat 2: Total Wins */}
        <div className="bg-surface-container-low p-4 sm:p-6 rounded-lg relative overflow-hidden group hover:bg-surface-container transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Icon className="text-6xl">workspace_premium</Icon>
          </div>
          <span className="font-technical text-on-surface/40 uppercase text-xs tracking-widest mb-3 block">Wins</span>
          <div className="flex items-end gap-2 flex-wrap">
            <span className="text-3xl sm:text-4xl font-stats text-on-surface font-bold">{s.wins}</span>
            <span className="text-on-surface/40 text-sm font-stats mb-1">{'/ ' + s.games}</span>
          </div>
        </div>

        {/* Stat 3: Avg Placement */}
        <div className="bg-surface-container-low p-4 sm:p-6 rounded-lg relative overflow-hidden group hover:bg-surface-container transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Icon className="text-6xl">analytics</Icon>
          </div>
          <span className="font-technical text-on-surface/40 uppercase text-xs tracking-widest mb-3 block">Avg Place</span>
          <div className="flex items-end gap-2">
            <span className="text-3xl sm:text-4xl font-stats text-on-surface font-bold">{s.avgPlacement}</span>
            <div className="w-8 h-1 bg-tertiary rounded-full mb-3"></div>
          </div>
        </div>

        {/* Stat 4: Win Streak */}
        <div className="bg-surface-container-low p-4 sm:p-6 rounded-lg relative overflow-hidden group border-b-2 border-primary/20 hover:bg-surface-container transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Icon className="text-primary text-6xl">local_fire_department</Icon>
          </div>
          <span className="font-technical text-primary uppercase text-xs tracking-widest mb-3 block">Streak</span>
          <div className="flex items-end gap-2">
            <span className="text-3xl sm:text-4xl font-stats text-primary font-bold">{player.currentStreak || 0}</span>
            <span className="text-primary/60 text-xs font-technical uppercase tracking-widest mb-1">Wins</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-px border-b border-outline-variant/20 -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map(function(t) {
          var label = t === 'h2h' ? 'H2H' : t === 'rounds' ? 'By Round' : t === 'deep-stats' ? 'Deep Stats' : t.charAt(0).toUpperCase() + t.slice(1);
          var isActive = tab === t;
          return (
            <button
              key={t}
              onClick={function() { setTab(t); }}
              className={'flex-shrink-0 px-4 sm:px-5 py-3 min-h-[44px] font-technical text-xs uppercase tracking-widest transition-all ' + (isActive ? 'text-primary border-b-2 border-primary -mb-px' : 'text-on-surface/40 hover:text-on-surface')}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-8">

          {/* Champion Banner */}
          {isChampion && (
            <div className="px-5 py-4 rounded-lg flex items-center gap-3 bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/40">
              <Icon className="text-2xl text-primary">emoji_events</Icon>
              <div className="flex-1">
                <div className="font-bold text-sm text-primary">{champion.title}</div>
                <div className="text-xs text-on-surface/60">{'Reigning champion since ' + champion.since}</div>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1 rounded font-technical text-xs tracking-widest border border-primary/20">
                {'SEASON ' + champion.season}
              </div>
            </div>
          )}

          {/* Hot/Cold Streak */}
          {((player.currentStreak || 0) >= 3 || (player.tiltStreak || 0) >= 3) && (
            <div className="flex gap-3 flex-wrap">
              {(player.currentStreak || 0) >= 3 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-primary bg-primary/10 border border-primary/30">
                  <Icon className="text-base text-[#F97316]">local_fire_department</Icon>
                  {'Hot Streak - ' + player.currentStreak + ' wins in a row'}
                </div>
              )}
              {(player.tiltStreak || 0) >= 3 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-[#93C5FD] bg-[#60A5FA]/10 border border-[#60A5FA]/30">
                  <Icon className="text-base text-[#38BDF8]">ac_unit</Icon>
                  {'Cold Streak - ' + player.tiltStreak + ' losses'}
                </div>
              )}
            </div>
          )}

          {/* Visual Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Placement Distribution */}
            <div className="lg:col-span-1 bg-surface-container-low p-8 rounded-lg">
              <PlacementDistribution history={player.clashHistory || []} />
            </div>

            {/* Season Trajectory Sparkline */}
            <div className="lg:col-span-2 bg-surface-container-low p-8 rounded-lg overflow-hidden relative">
              <div className="flex justify-between items-center mb-8 relative z-10">
                <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest">Season Trajectory</h3>
                <div className="flex gap-4 items-center">
                  <span className="font-stats text-xs text-primary">
                    {player.rank ? player.rank.toUpperCase() : 'UNRANKED'}
                  </span>
                  <Icon className="text-primary text-xs">arrow_forward</Icon>
                  <span className="font-stats text-xs text-primary">{'#' + seasonRank}</span>
                </div>
              </div>
              {/* SVG Sparkline */}
              <div className="relative h-48 w-full mt-4">
                {renderSparklineSvg(player.clashHistory)}
                <div className="absolute bottom-0 left-0 w-full flex justify-between px-2 pt-4 border-t border-outline-variant/10">
                  <span className="font-technical text-[10px] text-on-surface/20">WEEK 1</span>
                  <span className="font-technical text-[10px] text-on-surface/20">WEEK 4</span>
                  <span className="font-technical text-[10px] text-on-surface/20">WEEK 8</span>
                  <span className="font-technical text-[10px] text-primary">PRESENT</span>
                </div>
              </div>
            </div>
          </div>

          {/* Career Stats + Rates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Career Stats */}
            <div className="bg-surface-container-low p-8 rounded-lg">
              <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest mb-6">Career Stats</h3>
              <div className="rounded-lg p-4 mb-6 bg-primary/[0.05] border border-primary/15">
                <div className="text-[10px] font-technical text-on-surface/40 uppercase tracking-widest mb-3">Average Placement</div>
                <div className="flex gap-6 flex-wrap">
                  <div className="flex-1">
                    <div className="text-xs font-technical text-on-surface/60 mb-1">Career AVP</div>
                    <div className="font-stats text-2xl font-bold leading-tight" style={{ color: avgCol(s.avgPlacement) }}>{s.avgPlacement}</div>
                    <div className="text-[10px] text-on-surface/40 mt-1">all games - lower is better</div>
                  </div>
                  {s.perClashAvp && (
                    <div className="flex-1 pl-4 border-l border-on-surface/10">
                      <div className="text-xs font-technical text-on-surface/60 mb-1">Per-Clash AVP</div>
                      <div className="font-stats text-2xl font-bold leading-tight" style={{ color: avgCol(s.perClashAvp) }}>{s.perClashAvp}</div>
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
                    <span className="font-technical text-sm text-on-surface/60">{row[0]}</span>
                    <span className="font-stats text-sm font-bold" style={{ color: row[2] }}>{row[1]}</span>
                  </div>
                );
              })}
            </div>

            {/* Rates + Season Standing */}
            <div className="space-y-6">
              <div className="bg-surface-container-low p-8 rounded-lg">
                <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest mb-6">Performance Rates</h3>
                <RateBar label="Top 1%" value={s.top1Rate + '%'} color="#E8A838" />
                <RateBar label="Top 4%" value={s.top4Rate + '%'} color="#4ECDC4" />
                <RateBar label="Bot 4%" value={s.bot4Rate + '%'} color="#F87171" />
                <RateBar label="Comeback" value={s.comebackRate + '%'} color="#52C47C" />
                <RateBar label="Clutch" value={s.clutchRate + '%'} color="#9B72CF" />
              </div>

              <div className="bg-surface-container-low p-8 rounded-lg">
                <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest mb-4">Season Standing</h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="font-stats text-3xl font-bold text-primary">{'#' + seasonRank}</div>
                    <div className="font-technical text-[10px] text-on-surface/40 uppercase tracking-widest mt-1">Season Rank</div>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-xs font-technical text-on-surface/50">{'out of ' + players.length + ' players'}</div>
                    {player.region && <div className="text-xs font-technical text-on-surface/40 mt-1">{player.region + ' Region'}</div>}
                  </div>
                </div>
              </div>

              {/* Socials */}
              {(pTwitch || pTwitter || pYoutube) && (
                <div className="bg-surface-container-low p-8 rounded-lg">
                  <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest mb-4">Links</h3>
                  <div className="flex flex-col gap-2">
                    {pTwitch && (
                      <a href={'https://twitch.tv/' + pTwitch} target="_blank" rel="noopener noreferrer" className="text-xs text-primary no-underline flex items-center gap-2 hover:underline">
                        <Icon className="text-sm text-secondary">live_tv</Icon>
                        {'twitch.tv/' + pTwitch}
                      </a>
                    )}
                    {pTwitter && (
                      <a href={'https://x.com/' + pTwitter} target="_blank" rel="noopener noreferrer" className="text-xs text-tertiary no-underline flex items-center gap-2 hover:underline">
                        <Icon className="text-sm">alternate_email</Icon>
                        {'@' + pTwitter}
                      </a>
                    )}
                    {pYoutube && (
                      <a href={'https://youtube.com/@' + pYoutube} target="_blank" rel="noopener noreferrer" className="text-xs text-rose-400 no-underline flex items-center gap-2 hover:underline">
                        <Icon className="text-sm">smart_display</Icon>
                        {'youtube.com/@' + pYoutube}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Battle Logs */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-editorial text-2xl text-on-surface italic">Recent Battle Logs</h3>
              <button
                className="font-technical text-xs text-primary tracking-widest uppercase hover:underline"
                onClick={function() { setTab('history'); }}
              >
                View Full Match History
              </button>
            </div>
            <div className="space-y-3">
              {(player.clashHistory || []).length === 0 && (
                <div className="bg-surface-container-low p-8 rounded-lg text-center text-on-surface/40 font-technical text-sm">
                  No clash history yet
                </div>
              )}
              {(player.clashHistory || []).slice(0, 5).map(function(g, i) {
                var place = g.place || g.placement || '-';
                var isWin = place === 1;
                var isTop4 = place <= 4 && place !== '-';
                return (
                  <div
                    key={g.clashId || g.name || ("clash-" + i)}
                    className="bg-surface-container-low p-4 rounded-lg flex items-center justify-between group hover:bg-surface-container-high transition-all"
                  >
                    <div className="flex items-center gap-6">
                      <div
                        className={'w-12 h-12 flex flex-col items-center justify-center rounded border ' + (isWin ? 'bg-tertiary/10 border-tertiary/20' : 'bg-on-surface/5 border-outline-variant/10')}
                      >
                        <span className={'text-xl font-display ' + (isWin ? 'text-tertiary' : 'text-on-surface/40')}>{place}</span>
                        <span className={'text-[8px] font-technical -mt-1 uppercase ' + (isWin ? 'text-tertiary/60' : 'text-on-surface/20')}>
                          {typeof place === 'number' ? ordinalSuffix(place) : ''}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-technical text-sm font-semibold tracking-wide">{(g.name || 'Clash').toUpperCase()}</h4>
                        <p className="text-xs text-on-surface/40 font-body">
                          {g.date || ''}
                          {g.date ? ' - ' : ''}
                          {isTop4 ? 'Top 4' : 'Competitive'}
                        </p>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                      <div className="flex gap-1 flex-wrap">
                        {g.claimedClutch && (
                          <div className="bg-secondary-container/30 text-secondary px-2 py-0.5 rounded font-technical text-[10px] tracking-wider border border-secondary/20">
                            CLUTCH
                          </div>
                        )}
                        {g.comebackTriggered && (
                          <div className="bg-tertiary/10 text-tertiary px-2 py-0.5 rounded font-technical text-[10px] tracking-wider border border-tertiary/20">
                            COMEBACK
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={'block font-stats text-sm ' + (isTop4 ? 'text-primary' : 'text-on-surface')}>
                          {'+' + (g.pts || 0) + ' LP'}
                        </span>
                        <span className="block font-technical text-[10px] text-on-surface/40 uppercase">
                          {isWin ? 'Victory' : isTop4 ? 'Top 4' : 'Secure'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Rounds Tab */}
      {tab === 'rounds' && (
        <div className="bg-surface-container-low p-8 rounded-lg">
          <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest mb-6">Average Placement By Round</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[['R1', s.roundAvgs.r1, '#4ECDC4'], ['R2', s.roundAvgs.r2, '#9B72CF'], ['R3', s.roundAvgs.r3, '#EAB308'], ['Finals', s.roundAvgs.finals, '#E8A838']].map(function(row) {
              return (
                <div key={row[0]} className="rounded-lg p-4 text-center bg-white/[0.03] border border-on-surface/[0.07]">
                  <div className="font-technical text-[10px] text-on-surface/40 uppercase tracking-widest mb-2">{row[0]}</div>
                  {row[1]
                    ? (
                      <div>
                        <div className="font-stats text-xl font-bold leading-tight" style={{ color: avgCol(row[1]) }}>{row[1]}</div>
                        <div className="font-technical text-[10px] mt-1" style={{ color: avgCol(row[1]) }}>
                          {parseFloat(row[1]) < 3 ? 'Great' : parseFloat(row[1]) < 5 ? 'OK' : 'Rough'}
                        </div>
                      </div>
                    )
                    : <div className="font-stats text-lg text-on-surface/30">-</div>
                  }
                </div>
              );
            })}
          </div>

          <div className="font-technical text-xs text-on-surface/50 mb-4 uppercase tracking-widest">Per-clash round breakdown</div>
          {(player.clashHistory || []).length === 0 && (
            <div className="text-center py-8 text-on-surface/40 font-technical text-sm">No data yet</div>
          )}
          {(player.clashHistory || []).slice(0, 6).map(function(g, i) {
            return (
              <div key={g.clashId || g.name || ("round-" + i)} className="grid items-center gap-2 py-3 border-b border-on-surface/5 [grid-template-columns:1fr_50px_50px_50px_50px_60px]">
                <div>
                  <div className="font-technical font-bold text-sm text-on-surface">{g.name || 'Clash'}</div>
                  <div className="font-technical text-xs text-on-surface/40">{g.date || ''}</div>
                </div>
                {['r1', 'r2', 'r3', 'finals'].map(function(rk) {
                  var v = g.roundPlacements ? g.roundPlacements[rk] : null;
                  return (
                    <div key={rk} className="text-center">
                      {v
                        ? <span className={'font-stats text-sm font-bold ' + (v === 1 ? 'text-primary' : v <= 4 ? 'text-tertiary' : 'text-error')}>{'#' + v}</span>
                        : <span className="text-on-surface/30 font-stats">-</span>
                      }
                    </div>
                  );
                })}
                <div className="font-stats text-sm font-bold text-primary text-center">{'+' + g.pts}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="bg-surface-container-low rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-on-surface/10 flex items-center justify-between flex-wrap gap-2 bg-[#0e0d15]/60">
            <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest">Clash History</h3>
            {seasonConfig && seasonConfig.dropWeeks > 0 && (
              <span className="font-technical text-xs text-primary">{'Drop Weeks: ' + seasonConfig.dropWeeks + ' worst excluded'}</span>
            )}
          </div>
          {(player.clashHistory || []).length === 0
            ? (
              <div className="text-center py-12 text-on-surface/40 font-technical text-sm">No history yet</div>
            )
            : renderClashHistoryRows(player.clashHistory, seasonConfig)
          }
        </div>
      )}

      {/* H2H Tab */}
      {tab === 'h2h' && (
        <div>
          <div className="mb-6">
            <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest mb-1">Rivals and Head-to-Head</h3>
            <p className="font-body text-xs text-on-surface/50">Track your record against every player you have shared a lobby with.</p>
          </div>
          {(player.clashHistory || []).length === 0
            ? (
              <div className="text-center py-12 rounded-lg text-on-surface/40 bg-surface-container-low">
                <Icon className="text-4xl mb-3 block">emoji_events</Icon>
                <div className="font-technical text-sm font-bold text-on-surface/60 mb-1">No H2H data yet</div>
                <div className="font-body text-xs">Compete in a clash to build your rivalry record.</div>
              </div>
            )
            : (
              <div className="bg-surface-container-low rounded-lg overflow-hidden">
                <div className="px-6 py-3 border-b border-on-surface/10 flex justify-between items-center bg-surface-container-lowest/60">
                  <span className="font-technical text-xs font-bold text-on-surface/40 uppercase tracking-widest">Shared lobbies</span>
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
                    <div
                      key={op.id}
                      className={'px-6 py-4 border-b border-on-surface/5' + (i % 2 === 0 ? ' bg-white/[0.01]' : '')}
                    >
                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex-1">
                          <div className="font-technical font-bold text-sm text-on-surface">{op.name}</div>
                          <div className="font-technical text-xs text-on-surface/40">
                            {op.rank + ' - ' + op.region + ' - ' + sharedClashes.length + ' shared ' + (sharedClashes.length === 1 ? 'clash' : 'clashes')}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-stats text-sm">
                            <span className="font-bold text-emerald-400">{mW + 'W'}</span>
                            <span className="text-on-surface/40 mx-1">-</span>
                            <span className="font-bold text-rose-400">{tW + 'L'}</span>
                          </div>
                          <div className={'font-technical text-[10px] font-bold mt-0.5 ' + (ahead ? 'text-success' : tied ? 'text-primary' : 'text-error')}>
                            {ahead ? "You're ahead" : tied ? 'All tied' : "They're ahead"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-px h-1.5 rounded-full overflow-hidden bg-white/[0.05]">
                        <div className="rounded-l-full bg-[#6EE7B7] transition-[width] duration-[600ms]" style={{ width: (mW / total * 100) + '%' }} />
                        <div className="flex-1 bg-[#F87171]/30 rounded-r-full" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      )}

      {/* Deep Stats Tab */}
      {tab === 'deep-stats' && (
        <div>
          {deepLoading && (
            <div className="space-y-4">
              {[0,1,2].map(function(i) { return <div key={"skeleton-" + i} className="h-32 bg-surface-variant/30 animate-pulse rounded-lg" />; })}
            </div>
          )}
          {deepError && (
            <div className="py-12 text-center">
              <Icon className="text-3xl text-error/60 mb-2">error_outline</Icon>
              <p className="text-on-surface/40 text-sm font-technical">{deepError}</p>
            </div>
          )}
          {!deepLoading && !deepError && !deepStats && (
            <div className="py-12 text-center">
              <Icon className="text-4xl text-on-surface/20 mb-3">sports_esports</Icon>
              <p className="text-on-surface/40 text-sm font-technical uppercase tracking-widest">Need at least 3 games for stats</p>
            </div>
          )}
          {!deepLoading && !deepError && deepStats && (
            <div className="space-y-6">

              {/* Season Breakdown */}
              <div className="bg-surface-container-low rounded-lg p-6">
                <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest mb-4">Season Breakdown</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Games', value: deepStats.games_played },
                    { label: 'Avg Placement', value: parseFloat(deepStats.avg_placement).toFixed(2) },
                    { label: 'Win Rate', value: parseFloat(deepStats.win_rate).toFixed(1) + '%', green: true },
                    { label: 'Top-4 Rate', value: parseFloat(deepStats.top4_rate).toFixed(1) + '%', green: true },
                    { label: 'Bot-4 Rate', value: parseFloat(deepStats.bot4_rate).toFixed(1) + '%', red: true },
                    { label: '8th Rate', value: parseFloat(deepStats.eighth_rate).toFixed(1) + '%', red: true },
                    { label: 'Best Finish', value: '#' + deepStats.best_finish },
                    { label: 'Worst Finish', value: '#' + deepStats.worst_finish },
                  ].map(function(stat) {
                    return (
                      <div key={stat.label} className="bg-surface-container p-3 rounded-lg">
                        <div className="font-technical text-[10px] uppercase tracking-widest text-on-surface/40 mb-1">{stat.label}</div>
                        <div className={'font-display text-xl font-bold ' + (stat.green ? 'text-success' : stat.red ? 'text-error' : 'text-on-surface')}>
                          {stat.value}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Performance Scores */}
              <div className="bg-surface-container-low rounded-lg p-6">
                <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest mb-4">Performance Scores</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {renderDeepScoreCards(deepStats, deepGr)}
                </div>
              </div>

              {/* Placement Distribution (per-placement bars) */}
              <div className="bg-surface-container-low rounded-lg p-6">
                <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest mb-4">Placement Distribution</h3>
              {renderDeepPlacementBars(deepGr)}
              </div>

              {/* H2H Record */}
              {deepH2h && deepH2h.length > 0 && (
                <div className="bg-surface-container-low rounded-lg p-6">
                  <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest mb-4">Head-to-Head Record</h3>
                  <div className="space-y-0">
                    {deepH2h.slice().sort(function(a, b) { return b.meetings - a.meetings; }).map(function(r) {
                      var isA = r.player_a_id === player.id;
                      var opponent = isA ? r.player_b_name : r.player_a_name;
                      var myWins = parseInt(isA ? r.player_a_wins : r.player_b_wins);
                      var oppWins = parseInt(isA ? r.player_b_wins : r.player_a_wins);
                      var resultLabel = myWins > oppWins ? 'Winning' : oppWins > myWins ? 'Losing' : 'Even';
                      var resultColor = myWins > oppWins ? 'text-success bg-success/10 border-success/20'
                        : oppWins > myWins ? 'text-error bg-error/10 border-error/20'
                        : 'text-on-surface/50 bg-white/5 border-white/10';
                      return (
                        <div key={opponent} className="flex items-center gap-3 py-2.5 border-b border-on-surface/5 last:border-0">
                          <span className="font-technical font-semibold text-sm text-on-surface flex-1">{opponent}</span>
                          <span className="font-stats text-xs text-on-surface/50">{r.meetings + ' games'}</span>
                          <span className="font-mono text-xs text-on-surface/70">{myWins + 'W - ' + oppWins + 'L'}</span>
                          <span className={'text-[11px] font-technical px-2 py-0.5 rounded border ' + resultColor}>{resultLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Game Timeline */}
              {deepGr && deepGr.length > 0 && (
                <div className="bg-surface-container-low rounded-lg p-6">
                  <h3 className="font-technical text-on-surface uppercase text-sm tracking-widest mb-4">
                    {'Last ' + Math.min(deepGr.length, 50) + ' Games'}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {deepGr.slice(-50).reverse().map(function(r, i) {
                      var p = parseInt(r.placement);
                      var bg = p === 1 ? 'bg-yellow-400/80'
                             : p <= 4 ? 'bg-success/70'
                             : p <= 7 ? 'bg-surface-variant'
                             : 'bg-error/70';
                      return (
                        <div
                          key={r.id || ("game-" + i)}
                          className={'w-7 h-7 rounded flex items-center justify-center font-mono text-[10px] font-bold text-on-surface/80 cursor-default ' + bg}
                          title={'Place #' + p}
                        >
                          {p}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* Achievements Tab */}
      {tab === 'achievements' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACHIEVEMENTS.map(function(a) {
            var unlocked = false;
            try { unlocked = a.check(player); } catch (e) {}
            return (
              <div
                key={a.id}
                className="bg-surface-container-low p-6 rounded-lg"
                style={{ opacity: unlocked ? 1 : 0.4, border: '1px solid ' + (unlocked ? 'rgba(232,168,56,.3)' : 'rgba(242,237,228,.07)') }}
              >
                <div className="text-2xl mb-2">
                  <Icon className={'text-3xl ' + (unlocked ? 'text-primary' : '')}>{a.icon || 'military_tech'}</Icon>
                </div>
                <div className={'font-technical font-bold text-sm mb-1 ' + (unlocked ? 'text-on-surface' : 'text-muted')}>{a.name}</div>
                <div className="font-body text-xs text-on-surface/50 leading-relaxed">{a.desc}</div>
                {unlocked && (
                  <div className="mt-3">
                    <span className="font-technical text-[10px] px-2 py-1 rounded bg-primary/15 text-primary border border-primary/30">
                      UNLOCKED
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
