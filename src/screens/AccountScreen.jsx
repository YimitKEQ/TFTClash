import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats, ACHIEVEMENTS, MILESTONES, isHotStreak, estimateXp } from '../lib/stats.js'
import { rc, avgCol, shareToTwitter, buildShareText } from '../lib/utils.js'
import { supabase, CANONICAL_ORIGIN } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Icon, Inp } from '../components/ui'

// ─── ICON REMAP for Tabler icons ─────────────────────────────────────────────
var ICON_REMAP = {"exclamation-triangle-fill":"alert-triangle","exclamation-octagon-fill":"alert-octagon","info-circle-fill":"info-circle","check-circle-fill":"circle-check","x-circle-fill":"circle-x","slash-circle-fill":"ban","patch-check-fill":"rosette-discount-check","house-fill":"home","search":"search","three-dots":"dots","x-lg":"x","gear-fill":"settings","speedometer2":"gauge","download":"download","inbox":"inbox","clipboard":"clipboard","clipboard-check-fill":"clipboard-check","clipboard-data-fill":"clipboard-data","person-fill":"user","people-fill":"users","person-arms-up":"mood-happy","trophy-fill":"trophy","award-fill":"award","controller":"device-gamepad-2","dice-5-fill":"dice-5","bullseye":"target","crosshair":"crosshair","flag-fill":"flag","fire":"flame","snow":"snowflake","lightning-charge-fill":"bolt","sun-fill":"sun","moon-fill":"moon","water":"droplet-half-2","droplet":"droplet","droplet-fill":"droplet","hexagon-fill":"hexagon","diamond-half":"diamond","gem":"diamond","star-fill":"star","stars":"stars","heart-fill":"heart","shield-fill":"shield","shield-check":"shield-check","coin":"coin","bell-fill":"bell","bell-slash-fill":"bell-off","chat-fill":"message","megaphone-fill":"speakerphone","mic-fill":"microphone","broadcast-pin":"broadcast","calendar-event-fill":"calendar-event","calendar3":"calendar","calendar-check-fill":"calendar-check","bar-chart-line-fill":"chart-bar","graph-up-arrow":"trending-up","diagram-3-fill":"tournament","gift-fill":"gift","lock-fill":"lock","pin-fill":"pin","pencil-fill":"pencil","tag-fill":"tag","building":"building","tv-fill":"device-tv","pc-display":"device-desktop","mouse-fill":"mouse","headphones":"headphones","mortarboard-fill":"school","rocket-takeoff-fill":"rocket","journal-text":"notebook","question-circle-fill":"help-circle","eye-fill":"eye","emoji-dizzy":"mood-sad","pause-fill":"player-pause","archive-fill":"archive","arrow-up-circle-fill":"arrow-up-circle","twitter-x":"brand-x"};

function tablerIcon(name, sz, col) {
  var mapped = ICON_REMAP[name] || name;
  return (
    <i
      className={'ti ti-' + mapped}
      style={{ fontSize: sz || 'inherit', color: col || 'currentColor', lineHeight: 1, verticalAlign: 'middle' }}
    />
  );
}

// ─── Inline select component ─────────────────────────────────────────────────
function Sel({ value, onChange, children, style }) {
  return (
    <select
      value={value}
      onChange={function(e) { onChange(e.target.value); }}
      style={Object.assign({
        width: '100%',
        background: '#0F1520',
        border: '1px solid rgba(242,237,228,.15)',
        borderRadius: 8,
        padding: '9px 12px',
        color: '#F2EDE4',
        fontSize: 13,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }, style || {})}
    >
      {children}
    </select>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color, w, h }) {
  var W = w || 200;
  var H = h || 40;
  if (!data || data.length < 2) return null;
  var min = Math.min.apply(null, data);
  var max = Math.max.apply(null, data);
  var range = (max - min) || 1;
  var pts = data.map(function(v, i) {
    var x = (i / (data.length - 1)) * W;
    var y = H - ((v - min) / range) * (H - 4) + 2;
    return x + ',' + y;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color || '#E8A838'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={(data.length - 1) / (data.length - 1) * W}
        cy={H - ((data[data.length - 1] - min) / range) * (H - 4) + 2}
        r="2.5"
        fill={color || '#E8A838'}
      />
    </svg>
  );
}

// ─── Placement distribution ───────────────────────────────────────────────────
function PlacementDistribution({ history }) {
  var counts = [0, 0, 0, 0, 0, 0, 0, 0];
  (history || []).forEach(function(g) {
    var p = (g.place || g.placement || 1) - 1;
    if (p >= 0 && p < 8) counts[p]++;
  });
  var total = counts.reduce(function(s, v) { return s + v; }, 0) || 1;
  var colors = ['#E8A838', '#C0C0C0', '#CD7F32', '#4ECDC4', '#9AAABF', '#9AAABF', '#F87171', '#F87171'];

  return (
    <Panel style={{ padding: '16px', marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9AAABF', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 12 }}>Placement Distribution</div>
      {counts.map(function(count, i) {
        var pct = Math.round((count / total) * 100);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 20, fontSize: 11, fontWeight: 700, color: colors[i], textAlign: 'right', flexShrink: 0 }}>{'#' + (i + 1)}</div>
            <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,.05)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: pct + '%', height: '100%', background: colors[i], borderRadius: 4, transition: 'width .4s' }} />
            </div>
            <div style={{ width: 24, fontSize: 11, color: '#BECBD9', textAlign: 'right', flexShrink: 0 }}>{count}</div>
          </div>
        );
      })}
    </Panel>
  );
}

// ─── Main AccountScreen ───────────────────────────────────────────────────────
export default function AccountScreen() {
  var ctx = useApp();
  var currentUser = ctx.currentUser;
  var setCurrentUser = ctx.setCurrentUser;
  var players = ctx.players;
  var setPlayers = ctx.setPlayers;
  var isAdmin = ctx.isAdmin;
  var hostApps = ctx.hostApps;
  var toast = ctx.toast;
  var setScreen = ctx.setScreen;
  var navigate = useNavigate();

  var user = currentUser || {};

  var [tab, setTab] = useState('profile');
  var [edit, setEdit] = useState(false);

  var [bio, setBio] = useState(user.bio || '');
  var [twitch, setTwitch] = useState(user.twitch || '');
  var [twitter, setTwitter] = useState(user.twitter || '');
  var [youtube, setYoutube] = useState(user.youtube || '');
  var [usernameEdit, setUsernameEdit] = useState(user.username || '');
  var [profilePic, setProfilePic] = useState((user.user_metadata && user.user_metadata.profilePic) || user.profilePic || '');
  var [bannerUrl, setBannerUrl] = useState((user.user_metadata && user.user_metadata.bannerUrl) || user.bannerUrl || '');
  var [profileAccent, setProfileAccent] = useState((user.user_metadata && user.user_metadata.profileAccent) || user.profileAccent || '');
  var [riotId, setRiotId] = useState((user.user_metadata && (user.user_metadata.riotId || user.user_metadata.riot_id)) || '');
  var [riotRegion, setRiotRegion] = useState((user.user_metadata && (user.user_metadata.riotRegion || user.user_metadata.riot_region || user.user_metadata.region)) || 'EUW');
  var [secondRiotId, setSecondRiotId] = useState((user.user_metadata && user.user_metadata.secondRiotId) || user.secondRiotId || '');
  var [secondRegion, setSecondRegion] = useState((user.user_metadata && user.user_metadata.secondRegion) || user.secondRegion || 'EUW');
  var [subscription, setSubscription] = useState(null);

  var usernameChanged = !!(user.user_metadata && user.user_metadata.username_changed);
  var riotIdSet = !!(user.user_metadata && (user.user_metadata.riotId || user.user_metadata.riot_id));
  var EU_NA = ['EUW', 'EUNE', 'NA'];

  var linkedPlayer = players.find(function(p) {
    return (p.authUserId && p.authUserId === user.id) || (p.id === user.linkedPlayerId) || (p.name === user.username);
  });

  var s = linkedPlayer ? getStats(linkedPlayer) : null;
  var rankColor = linkedPlayer ? rc(linkedPlayer.rank) : '#9B72CF';
  var isPro = !!(subscription && (subscription.plan === 'pro' || subscription.plan === 'host'));

  var myAchievements = linkedPlayer ? ACHIEVEMENTS.filter(function(a) { try { return a.check(linkedPlayer); } catch(e) { return false; } }) : [];
  var myMilestones = linkedPlayer ? MILESTONES.filter(function(m) { try { return m.check(linkedPlayer); } catch(e) { return false; } }) : [];

  var tierCols = { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#E8A838', legendary: '#9B72CF' };

  var acctProfileFields = [
    user.user_metadata && user.user_metadata.riot_id,
    user.user_metadata && user.user_metadata.bio,
    user.user_metadata && user.user_metadata.region,
  ];
  var acctProfileComplete = acctProfileFields.filter(Boolean).length;
  var acctProfileTotal = acctProfileFields.length;
  var acctMissingField = !(user.user_metadata && user.user_metadata.riot_id) ? 'Riot ID' : !(user.user_metadata && user.user_metadata.bio) ? 'bio' : 'region';
  var acctProgressMsg = 'Profile ' + acctProfileComplete + '/' + acctProfileTotal + ' complete' + (acctProfileComplete < acctProfileTotal ? ' - Add a ' + acctMissingField + ' to finish' : '');

  useEffect(function() {
    if (!user || !user.id) return;
    supabase.from('subscriptions').select('plan,status').eq('user_id', user.id).single()
      .then(function(res) { if (res.data && res.data.status === 'active') setSubscription(res.data); });
  }, [user && user.id]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setScreen('home');
      navigate('/');
      toast('Logged out successfully', 'info');
    } catch(e) {
      console.error('[TFT] logout failed:', e);
      toast('Logout failed', 'error');
    }
  }

  async function save() {
    var meta = Object.assign({}, user.user_metadata || {}, {
      bio: bio,
      twitch: twitch,
      twitter: twitter,
      youtube: youtube,
      secondRiotId: secondRiotId,
      secondRegion: secondRegion,
      profilePic: profilePic,
      bannerUrl: bannerUrl,
      profileAccent: profileAccent,
    });

    if (!usernameChanged && usernameEdit.trim() && usernameEdit.trim() !== user.username) {
      meta.username = usernameEdit.trim();
      meta.username_changed = true;
    }

    if (!riotIdSet && riotId.trim()) {
      meta.riotId = riotId.trim();
      meta.riotRegion = riotRegion;
      meta.riotIdSet = true;
    }

    try {
      await supabase.auth.updateUser({ data: meta });
    } catch(e) {
      console.warn('Supabase update failed', e);
      toast('Failed to save profile - please try again', 'error');
      return;
    }

    var socialLinks = { twitch: meta.twitch || '', twitter: meta.twitter || '', youtube: meta.youtube || '' };
    var playerUpdate = { bio: meta.bio || '', region: riotRegion, social_links: socialLinks };
    if (!riotIdSet && meta.riotId) {
      playerUpdate.riot_id = meta.riotId;
      playerUpdate.region = riotRegion;
    }
    supabase.from('players').update(playerUpdate).eq('auth_user_id', user.id).then(function(pRes) {
      if (pRes.error) console.error('[TFT] Players table update failed:', pRes.error);
    });

    var updated = Object.assign({}, user, meta, {
      username: meta.username || user.username,
      user_metadata: meta,
      region: riotRegion,
      mainRegion: riotRegion,
      secondRiotId: secondRiotId,
      secondRegion: secondRegion,
      profilePic: profilePic,
      bannerUrl: bannerUrl,
      profileAccent: profileAccent,
    });
    setCurrentUser(updated);
    setEdit(false);
    toast('Profile updated', 'success');
  }

  async function requestChange(field) {
    var pending = ((user.user_metadata && user.user_metadata.pending_changes) || []).concat([{ field: field, requestedAt: new Date().toISOString() }]);
    try { await supabase.auth.updateUser({ data: Object.assign({}, user.user_metadata || {}, { pending_changes: pending }) }); } catch(e) { /* ignore */ }
    toast('Change request submitted - an admin will review it', 'success');
  }

  if (!user || !user.id) {
    return (
      <PageLayout>
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>{tablerIcon('user-circle', 40, '#9B72CF')}</div>
          <h2 style={{ color: '#F2EDE4', marginBottom: 10 }}>Sign in to view your account</h2>
          <Btn v="primary" onClick={function() { setScreen('login'); navigate('/login'); }}>Sign In</Btn>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 8 }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Btn v="dark" s="sm" onClick={function() { setScreen('home'); navigate('/'); }}>
            {tablerIcon('arrow-left', 12)} Back
          </Btn>
          <h2 style={{ color: '#F2EDE4', fontSize: 20, margin: 0, flex: 1 }}>My Account</h2>
          {linkedPlayer && (
            <Btn v="dark" s="sm" onClick={function() {
              var myRank = ([...players].sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(p) { return p.id === linkedPlayer.id; }) + 1);
              shareToTwitter(buildShareText('profile', { name: user.username, rank: myRank, pts: linkedPlayer.pts }));
            }}>
              {tablerIcon('brand-x', 11)} Share
            </Btn>
          )}
          <Btn v="dark" s="sm" onClick={handleLogout}>Sign Out</Btn>
        </div>

        {/* Riot ID warning */}
        {!riotIdSet && (
          <div style={{ background: 'rgba(232,168,56,.1)', border: '1px solid rgba(232,168,56,.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>{tablerIcon('alert-triangle', 18, '#E8A838')}</span>
            <div>
              <div style={{ color: '#E8A838', fontWeight: 600, fontSize: 13 }}>Set your Riot ID to join tournaments</div>
              <div style={{ color: '#BECBD9', fontSize: 12 }}>You need a Riot ID to register for flash tournaments.</div>
            </div>
          </div>
        )}

        {/* Profile completion */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: acctProfileComplete === acctProfileTotal ? '#52C47C' : '#E8A838', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: acctProfileComplete === acctProfileTotal ? '#52C47C' : '#BECBD9', fontWeight: 500 }}>{acctProgressMsg}</span>
        </div>

        {/* Hero card */}
        <div style={{ position: 'relative', borderRadius: 16, marginBottom: 20, overflow: 'hidden', border: '1px solid rgba(242,237,228,.12)' }}>
          {/* Banner */}
          <div style={{ height: bannerUrl ? 140 : 90, background: bannerUrl ? ('url(' + bannerUrl + ') center/cover no-repeat') : ('linear-gradient(135deg,' + (profileAccent || rankColor) + '33,#08080F 80%)'), position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%,#08080F)' }} />
          </div>

          <div style={{ padding: '0 24px 24px', marginTop: -44 }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>

              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 88, height: 88, borderRadius: '50%',
                  background: profilePic ? ('url(' + profilePic + ') center/cover no-repeat') : ('linear-gradient(135deg,' + rankColor + '44,' + rankColor + '11)'),
                  border: '4px solid #08080F',
                  boxShadow: '0 0 0 2px ' + (profileAccent || rankColor) + '66',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: profilePic ? 0 : 34, fontWeight: 800, color: rankColor,
                }}>
                  {!profilePic && (user.username || 'U').charAt(0).toUpperCase()}
                </div>
                {isPro && (
                  <div style={{ position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#E8A838,#C8882A)', border: '2px solid #08080F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 900 }}>
                    {'\u2605'}
                  </div>
                )}
                {myMilestones.length > 0 && (
                  <div style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: '#E8A838', border: '2px solid #08080F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                    {tablerIcon(ICON_REMAP[myMilestones[myMilestones.length - 1].icon] || myMilestones[myMilestones.length - 1].icon, 11)}
                  </div>
                )}
              </div>

              {/* Name + info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 900, color: '#F2EDE4', margin: 0 }}>{user.username}</h2>
                  {isPro && (
                    <span style={{ background: 'linear-gradient(90deg,#E8A838,#C8882A)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 800, color: '#08080F', letterSpacing: '.04em' }}>PRO</span>
                  )}
                  {linkedPlayer && isHotStreak(linkedPlayer) && (
                    <span style={{ fontSize: 14 }}>{tablerIcon('flame', 14, '#F97316')}</span>
                  )}
                </div>

                {linkedPlayer && (
                  <div style={{ fontSize: 13, color: '#BECBD9', marginBottom: 8 }}>
                    {linkedPlayer.riotId} {linkedPlayer.region ? ('- ' + linkedPlayer.region) : ''}
                  </div>
                )}

                <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {subscription ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, background: subscription.plan === 'host' ? 'rgba(232,168,56,.15)' : 'rgba(155,114,207,.15)', border: '1px solid ' + (subscription.plan === 'host' ? 'rgba(232,168,56,.4)' : 'rgba(155,114,207,.4)'), fontSize: 12, fontWeight: 700, color: subscription.plan === 'host' ? '#E8A838' : '#C4B5FD' }}>
                      {subscription.plan === 'host' ? 'Host Plan' : 'Pro Plan'} - Active
                    </div>
                  ) : (
                    <button onClick={function() { setScreen('pricing'); navigate('/pricing'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'transparent', border: '1px solid rgba(155,114,207,.35)', fontSize: 12, color: '#9B72CF', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Upgrade to Pro
                    </button>
                  )}
                  {(isAdmin || (hostApps || []).some(function(a) { return a.status === 'approved' && (a.name === user.username || a.email === user.email); })) && (
                    <button onClick={function() { setScreen('host-dashboard'); navigate('/host-dashboard'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(232,168,56,.12)', border: '1px solid rgba(232,168,56,.4)', fontSize: 12, fontWeight: 700, color: '#E8A838', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {tablerIcon('device-gamepad-2', 12)} Host Dashboard
                    </button>
                  )}
                </div>

                {user.bio ? (
                  <p style={{ fontSize: 13, color: '#C8D4E0', lineHeight: 1.6, margin: 0, maxWidth: 480 }}>{user.bio}</p>
                ) : (
                  <p style={{ fontSize: 13, color: '#9AAABF', fontStyle: 'italic', margin: 0 }}>No bio yet - tell people who you are.</p>
                )}

                {(user.twitch || user.twitter || user.youtube) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {user.twitch && (
                      <a href={'https://twitch.tv/' + user.twitch} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#9147FF', background: 'rgba(145,71,255,.1)', border: '1px solid rgba(145,71,255,.3)', borderRadius: 6, padding: '3px 10px', textDecoration: 'none', fontWeight: 700 }}>
                        {tablerIcon('device-tv', 10)} {user.twitch}
                      </a>
                    )}
                    {user.twitter && (
                      <a href={'https://twitter.com/' + user.twitter} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1DA1F2', background: 'rgba(29,161,242,.1)', border: '1px solid rgba(29,161,242,.3)', borderRadius: 6, padding: '3px 10px', textDecoration: 'none', fontWeight: 700 }}>
                        {tablerIcon('brand-x', 10)} {user.twitter}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Quick pts */}
              {linkedPlayer && (
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 40, fontWeight: 900, color: '#E8A838', lineHeight: 1 }}>{linkedPlayer.pts}</div>
                  <div style={{ fontSize: 11, color: '#BECBD9', marginTop: 2 }}>Clash Points</div>
                  <div style={{ fontSize: 12, color: '#C8D4E0', marginTop: 4 }}>
                    Season Rank #{[...players].sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(p) { return p.id === linkedPlayer.id; }) + 1}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#111827', borderRadius: 10, padding: 4 }}>
          {[['profile', 'Profile'], ['stats', 'Stats'], ['achievements', 'Achievements'], ['history', 'History']].map(function(item) {
            var v = item[0];
            var l = item[1];
            return (
              <button
                key={v}
                onClick={function() { setTab(v); }}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 12,
                  background: tab === v ? '#1E2A3A' : 'transparent',
                  color: tab === v ? '#F2EDE4' : '#BECBD9',
                  transition: 'all .15s',
                  fontFamily: 'inherit',
                }}
              >
                {l}
              </button>
            );
          })}
        </div>

        {/* ── PROFILE TAB ──────────────────────────────────────────────────────── */}
        {tab === 'profile' && (
          <Panel style={{ padding: '20px' }}>
            {!edit ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ color: '#F2EDE4', fontSize: 15, margin: 0 }}>Profile Details</h3>
                  <Btn v="dark" s="sm" onClick={function() { setEdit(true); }}>
                    {tablerIcon('pencil', 11)} Edit
                  </Btn>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  {[
                    ['Username', user.username, usernameChanged ? '#9B72CF' : '#F2EDE4'],
                    ['Riot ID', (user.user_metadata && (user.user_metadata.riotId || user.user_metadata.riot_id)) ? ((user.user_metadata.riotId || user.user_metadata.riot_id) + ' - ' + (user.user_metadata.riotRegion || user.user_metadata.riot_region || user.user_metadata.region || 'EUW')) : null, '#E8A838'],
                    ['Secondary Riot ID', (user.user_metadata && user.user_metadata.secondRiotId) ? (user.user_metadata.secondRiotId + ' - ' + (user.user_metadata.secondRegion || 'EUW')) : null, '#C4B5FD'],
                    ['Bio', (user.user_metadata && user.user_metadata.bio) || user.bio || null, '#C8D4E0'],
                    ['Twitch', (user.user_metadata && user.user_metadata.twitch) || user.twitch ? ('twitch.tv/' + ((user.user_metadata && user.user_metadata.twitch) || user.twitch)) : null, '#9147FF'],
                    ['Twitter', (user.user_metadata && user.user_metadata.twitter) || user.twitter ? ('@' + ((user.user_metadata && user.user_metadata.twitter) || user.twitter)) : null, '#1DA1F2'],
                    ['Profile Picture', profilePic ? 'Custom avatar set' : 'Not set (default initial)', profilePic ? '#6EE7B7' : '#9AAABF'],
                    ['Banner', bannerUrl ? 'Custom banner set' : 'Not set (rank gradient)', bannerUrl ? '#6EE7B7' : '#9AAABF'],
                  ].map(function(row) {
                    var label = row[0];
                    var val = row[1];
                    var col = row[2];
                    return (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(242,237,228,.07)' }}>
                        <span style={{ color: '#BECBD9', fontSize: 13 }}>{label}</span>
                        <span style={{ color: val ? col : '#9AAABF', fontSize: 13, fontWeight: val ? 600 : 400, maxWidth: 280, textAlign: 'right' }}>{val || '-'}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Discord connection */}
                {(function() {
                  var discordId = user.identities && user.identities.find(function(i) { return i.provider === 'discord'; }) && user.identities.find(function(i) { return i.provider === 'discord'; }).identity_data && user.identities.find(function(i) { return i.provider === 'discord'; }).identity_data.sub;
                  var discordIdent = user.identities && user.identities.find(function(i) { return i.provider === 'discord'; });
                  var discordName = discordIdent && discordIdent.identity_data && (discordIdent.identity_data.global_name || discordIdent.identity_data.full_name);
                  return (
                    <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(88,101,242,.06)', border: '1px solid rgba(88,101,242,.25)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <svg width="20" height="15" viewBox="0 0 71 55" fill="#5865F2" xmlns="http://www.w3.org/2000/svg"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.22.22 0 0 0-.23.11 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.83-3.7.23.23 0 0 0-.23-.11A58.3 58.3 0 0 0 10.9 4.9a.21.21 0 0 0-.1.08C1.58 18.73-.96 32.16.3 45.43a.24.24 0 0 0 .09.17 58.8 58.8 0 0 0 17.7 8.95.23.23 0 0 0 .25-.09 42 42 0 0 0 3.62-5.89.23.23 0 0 0-.12-.31 38.7 38.7 0 0 1-5.52-2.63.23.23 0 0 1-.02-.38c.37-.28.74-.57 1.1-.86a.22.22 0 0 1 .23-.03c11.58 5.29 24.12 5.29 35.56 0a.22.22 0 0 1 .23.03c.36.29.73.58 1.1.86a.23.23 0 0 1-.02.38 36.3 36.3 0 0 1-5.52 2.63.23.23 0 0 0-.13.31 47.2 47.2 0 0 0 3.62 5.89c.06.09.17.12.26.09a58.7 58.7 0 0 0 17.71-8.95.23.23 0 0 0 .09-.16c1.48-15.32-2.48-28.64-10.5-40.45a.18.18 0 0 0-.09-.09ZM23.7 37.3c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.82 7.15-6.37 7.15Zm23.58 0c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.79 7.15-6.37 7.15Z"/></svg>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: discordId ? '#6EE7B7' : '#C8D4E0' }}>Discord {discordId ? 'Connected' : 'Not Connected'}</div>
                          {discordId ? (
                            <div style={{ fontSize: 11, color: '#9AAABF' }}>{discordName || 'ID: ' + discordId}</div>
                          ) : (
                            <div style={{ fontSize: 11, color: '#9AAABF' }}>Link to auto-sync with our Discord bot</div>
                          )}
                        </div>
                      </div>
                      {!discordId ? (
                        <button
                          onClick={async function() { await supabase.auth.linkIdentity({ provider: 'discord', options: { redirectTo: CANONICAL_ORIGIN + '#account' } }); }}
                          style={{ padding: '7px 14px', background: '#5865F2', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}
                        >
                          Connect Discord
                        </button>
                      ) : (
                        <button
                          onClick={async function() {
                            if (!window.confirm('Disconnect Discord? You will need a password to log in.')) return;
                            try {
                              var discIdent = user.identities && user.identities.find(function(i) { return i.provider === 'discord'; });
                              await supabase.auth.unlinkIdentity(discIdent);
                              toast('Discord disconnected', 'success');
                              handleLogout();
                            } catch(e) {
                              toast('Could not disconnect: ' + e.message, 'error');
                            }
                          }}
                          style={{ padding: '7px 14px', background: 'rgba(220,38,38,.12)', border: '1px solid rgba(220,38,38,.4)', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#F87171', flexShrink: 0 }}
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Danger zone */}
                <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(220,38,38,.04)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#F87171', marginBottom: 6 }}>Danger Zone</div>
                  <div style={{ fontSize: 12, color: '#9AAABF', marginBottom: 10 }}>Permanently delete your account and all data. This cannot be undone.</div>
                  <button
                    onClick={async function() {
                      if (!window.confirm('Delete your account permanently? This cannot be undone.')) return;
                      try {
                        if (supabase.from) {
                          await supabase.from('registrations').delete().eq('player_id', user.id).catch(function() {});
                          await supabase.from('notifications').delete().eq('user_id', user.id).catch(function() {});
                          await supabase.from('player_achievements').delete().eq('player_id', user.id).catch(function() {});
                          await supabase.from('players').delete().eq('auth_user_id', user.id).catch(function() {});
                        }
                        if (setPlayers) {
                          setPlayers(function(ps) {
                            return ps.filter(function(p) {
                              return p.authUserId !== user.id && (p.name || '').toLowerCase() !== (user.username || '').toLowerCase();
                            });
                          });
                        }
                        await supabase.auth.signOut();
                        handleLogout();
                        toast('Account deleted - signed out', 'success');
                      } catch(e) {
                        await supabase.auth.signOut();
                        handleLogout();
                      }
                    }}
                    style={{ padding: '7px 14px', background: 'rgba(220,38,38,.15)', border: '1px solid rgba(220,38,38,.5)', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#F87171', fontFamily: 'inherit' }}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ color: '#F2EDE4', fontSize: 15, margin: 0 }}>Edit Profile</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn v="dark" s="sm" onClick={function() { setEdit(false); }}>Cancel</Btn>
                    <Btn v="primary" s="sm" onClick={save}>Save Changes</Btn>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 16 }}>

                  {/* Username */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ fontSize: 12, color: '#BECBD9' }}>
                        Username {usernameChanged && <span style={{ color: '#9B72CF', fontSize: 11 }}>(locked - changed once)</span>}
                      </div>
                    </div>
                    {usernameChanged ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1, background: '#0F1520', border: '1px solid rgba(242,237,228,.08)', borderRadius: 8, padding: '9px 12px', color: '#9AAABF', fontSize: 13 }}>{user.username}</div>
                        <Btn v="dark" s="sm" onClick={function() { requestChange('username'); }}>Request Change</Btn>
                      </div>
                    ) : (
                      <div>
                        <Inp value={usernameEdit} onChange={setUsernameEdit} placeholder="Your display name" />
                        <div style={{ fontSize: 11, color: '#9AAABF', marginTop: 4 }}>You can only change this once. After that, contact admin.</div>
                      </div>
                    )}
                  </div>

                  {/* Main Riot ID */}
                  <div>
                    <div style={{ fontSize: 12, color: '#BECBD9', marginBottom: 5 }}>
                      Main Riot ID {riotIdSet && <span style={{ color: '#E8A838', fontSize: 11 }}>(locked)</span>}
                    </div>
                    {riotIdSet ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1, background: '#0F1520', border: '1px solid rgba(232,168,56,.15)', borderRadius: 8, padding: '9px 12px', color: '#E8A838', fontSize: 13, fontWeight: 600 }}>
                          {(user.user_metadata && (user.user_metadata.riotId || user.user_metadata.riot_id))} - {(user.user_metadata && (user.user_metadata.riotRegion || user.user_metadata.riot_region || user.user_metadata.region)) || 'EUW'}
                        </div>
                        <Btn v="dark" s="sm" onClick={function() { requestChange('riotId'); }}>Request Change</Btn>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
                        <Inp value={riotId} onChange={setRiotId} placeholder="GameName#TAG" />
                        <Sel value={riotRegion} onChange={setRiotRegion}>
                          {EU_NA.map(function(r) { return <option key={r} value={r}>{r}</option>; })}
                        </Sel>
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#9AAABF', marginTop: 4 }}>EU and NA accounts only. Cannot be changed without admin approval.</div>
                  </div>

                  {/* Secondary Riot ID */}
                  <div>
                    <div style={{ fontSize: 12, color: '#BECBD9', marginBottom: 5 }}>
                      Secondary Riot ID <span style={{ color: '#9AAABF', fontWeight: 400 }}>(optional)</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
                      <Inp value={secondRiotId} onChange={setSecondRiotId} placeholder="SecondName#TAG" />
                      <Sel value={secondRegion} onChange={setSecondRegion}>
                        {EU_NA.map(function(r) { return <option key={r} value={r}>{r}</option>; })}
                      </Sel>
                    </div>
                    <div style={{ fontSize: 11, color: '#9AAABF', marginTop: 4 }}>For players on both EU and NA. EU and NA only.</div>
                  </div>

                  {/* Bio */}
                  <div>
                    <div style={{ fontSize: 12, color: '#BECBD9', marginBottom: 5 }}>Bio</div>
                    <textarea
                      value={bio}
                      onChange={function(e) { setBio(e.target.value); }}
                      maxLength={160}
                      placeholder="Tell people who you are..."
                      style={{ width: '100%', background: '#0F1520', border: '1px solid rgba(242,237,228,.15)', borderRadius: 8, padding: '10px 12px', color: '#F2EDE4', fontSize: 13, resize: 'none', height: 72, fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: 11, color: '#9AAABF', marginTop: 2, textAlign: 'right' }}>{bio.length}/160</div>
                  </div>

                  {/* Appearance - Pro only */}
                  <div style={{ borderTop: '1px solid rgba(242,237,228,.08)', paddingTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#F2EDE4' }}>Appearance</div>
                      {isPro ? (
                        <span style={{ background: 'linear-gradient(90deg,#E8A838,#C8882A)', borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: '#08080F' }}>PRO</span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#9AAABF' }}>(Pro feature)</span>
                      )}
                    </div>

                    {isPro ? (
                      <div style={{ display: 'grid', gap: 14 }}>
                        <div>
                          <div style={{ fontSize: 12, color: '#BECBD9', marginBottom: 5 }}>Profile Picture</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(155,114,207,.12)', border: '1px solid rgba(155,114,207,.35)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#C4B5FD', flexShrink: 0 }}>
                              Upload Photo
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={function(e) {
                                  var file = e.target.files[0];
                                  if (!file) return;
                                  if (file.size > 2 * 1024 * 1024) { toast('Max 2MB', 'error'); return; }
                                  supabase.storage.from('avatars').upload(user.id + '/avatar.png', file, { upsert: true })
                                    .then(function(res) {
                                      if (res.error) { toast('Upload failed', 'error'); return; }
                                      var url = supabase.storage.from('avatars').getPublicUrl(user.id + '/avatar.png').data.publicUrl;
                                      setProfilePic(url);
                                      supabase.from('players').update({ profile_pic_url: url }).eq('auth_user_id', user.id);
                                      toast('Avatar updated!', 'success');
                                    });
                                }}
                              />
                            </label>
                            <span style={{ fontSize: 11, color: '#9AAABF' }}>or paste URL below</span>
                          </div>
                          <Inp value={profilePic} onChange={setProfilePic} placeholder="https://i.imgur.com/your-pic.png" />
                          <div style={{ fontSize: 10, color: '#9AAABF', marginTop: 3 }}>Max 2MB. Square images work best.</div>
                          {profilePic && (
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'url(' + profilePic + ') center/cover', border: '2px solid ' + rankColor + '44' }} />
                              <span style={{ fontSize: 11, color: '#6EE7B7' }}>Preview</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#BECBD9', marginBottom: 5 }}>Banner Image URL</div>
                          <Inp value={bannerUrl} onChange={setBannerUrl} placeholder="https://i.imgur.com/your-banner.png" />
                          <div style={{ fontSize: 10, color: '#9AAABF', marginTop: 3 }}>Recommended: 1500x500 or similar wide aspect ratio.</div>
                          {bannerUrl && <div style={{ marginTop: 8, height: 60, borderRadius: 8, background: 'url(' + bannerUrl + ') center/cover', border: '1px solid rgba(242,237,228,.1)' }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#BECBD9', marginBottom: 8 }}>Profile Accent Color</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {['', '#9B72CF', '#E8A838', '#4ECDC4', '#F87171', '#6EE7B7', '#60A5FA', '#FB923C', '#EC4899', '#8B5CF6'].map(function(clr) {
                              var isActive = profileAccent === clr;
                              return (
                                <div
                                  key={clr || 'default'}
                                  onClick={function() { setProfileAccent(clr); }}
                                  style={{ width: 28, height: 28, borderRadius: '50%', background: clr || ('linear-gradient(135deg,' + rankColor + '44,' + rankColor + '11)'), cursor: 'pointer', border: isActive ? '3px solid #fff' : '3px solid transparent', transition: 'border .15s', position: 'relative' }}
                                >
                                  {!clr && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#BECBD9' }}>Auto</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(232,168,56,.04)', border: '1px dashed rgba(232,168,56,.25)', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 13, color: '#E8A838', fontWeight: 600, marginBottom: 6 }}>Unlock Profile Customization</div>
                        <div style={{ fontSize: 12, color: '#BECBD9', marginBottom: 12 }}>Set a custom avatar, banner image, and accent color. Make your profile stand out.</div>
                        <button
                          onClick={function() { setScreen('pricing'); navigate('/pricing'); setEdit(false); }}
                          style={{ background: 'linear-gradient(90deg,#E8A838,#C8882A)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, color: '#08080F', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Go Pro - EUR 4.99/mo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Socials */}
                  <div>
                    <div style={{ fontSize: 12, color: '#BECBD9', marginBottom: 5 }}>Twitch username</div>
                    <Inp value={twitch} onChange={setTwitch} placeholder="your_twitch_name" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#BECBD9', marginBottom: 5 }}>Twitter / X handle</div>
                    <Inp value={twitter} onChange={setTwitter} placeholder="@yourhandle" />
                  </div>
                </div>
              </div>
            )}
          </Panel>
        )}

        {/* ── STATS TAB ─────────────────────────────────────────────────────────── */}
        {tab === 'stats' && (
          <div>
            {linkedPlayer && s ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 16 }}>
                  {[
                    { l: 'Clash Points', v: linkedPlayer.pts, c: '#E8A838' },
                    { l: 'Total Wins', v: linkedPlayer.wins, c: '#6EE7B7' },
                    { l: 'Top 4 Rate', v: s.top4Rate + '%', c: '#C4B5FD' },
                    { l: 'Avg Placement', v: s.avgPlacement, c: avgCol(s.avgPlacement) },
                    { l: 'Games Played', v: linkedPlayer.games, c: '#4ECDC4' },
                    { l: 'Best Streak', v: linkedPlayer.bestStreak, c: '#F87171' },
                    { l: 'PPG', v: s.ppg, c: '#EAB308' },
                    { l: 'Clutch Rate', v: s.clutchRate + '%', c: '#9B72CF' },
                  ].map(function(item) {
                    return (
                      <div key={item.l} className="inner-box" style={{ padding: '14px 12px', textAlign: 'center' }}>
                        <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: item.c, lineHeight: 1 }}>{item.v}</div>
                        <div style={{ fontSize: 10, color: '#BECBD9', marginTop: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{item.l}</div>
                      </div>
                    );
                  })}
                </div>

                {linkedPlayer.sparkline && linkedPlayer.sparkline.length > 0 && (
                  <Panel style={{ padding: '16px', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#F2EDE4', marginBottom: 10 }}>Points Trend</div>
                    <Sparkline data={linkedPlayer.sparkline} color="#E8A838" h={60} />
                  </Panel>
                )}

                <PlacementDistribution history={linkedPlayer.clashHistory || []} />

                {(function() {
                  var acctHistory = linkedPlayer.clashHistory || [];
                  var ppTrend2 = [];
                  var ppCum2 = 0;
                  acctHistory.forEach(function(c) { ppCum2 = ppCum2 + (c.points || 0); ppTrend2.push(ppCum2); });
                  if (ppTrend2.length <= 1) return null;
                  return (
                    <Panel style={{ padding: '16px', marginTop: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#F2EDE4', marginBottom: 10 }}>Season Trajectory</div>
                      <Sparkline data={ppTrend2} w={280} h={40} color="#9B72CF" />
                    </Panel>
                  );
                })()}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{tablerIcon('chart-bar', 40, '#BECBD9')}</div>
                <div style={{ color: '#BECBD9', fontSize: 14 }}>No stats linked to your account yet.</div>
                <div style={{ color: '#9AAABF', fontSize: 12, marginTop: 6 }}>Your account name must match a registered player.</div>
              </div>
            )}
          </div>
        )}

        {/* ── ACHIEVEMENTS TAB ──────────────────────────────────────────────────── */}
        {tab === 'achievements' && (
          <div>
            {linkedPlayer ? (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#F2EDE4' }}>{myAchievements.length} of {ACHIEVEMENTS.length} unlocked</span>
                  {['legendary', 'gold', 'silver', 'bronze'].map(function(tier) {
                    var n = myAchievements.filter(function(a) { return a.tier === tier; }).length;
                    if (!n) return null;
                    return (
                      <span key={tier} style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: tierCols[tier] + '22', color: tierCols[tier], border: '1px solid ' + tierCols[tier] + '44' }}>
                        {n} {tier}
                      </span>
                    );
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
                  {ACHIEVEMENTS.map(function(a) {
                    var unlocked = false;
                    try { unlocked = a.check(linkedPlayer); } catch(e) { unlocked = false; }
                    var col = tierCols[a.tier];
                    return (
                      <div
                        key={a.id}
                        style={{
                          background: unlocked ? col + '11' : 'rgba(255,255,255,.02)',
                          border: '1px solid ' + (unlocked ? col + '44' : 'rgba(242,237,228,.06)'),
                          borderRadius: 10, padding: '12px', opacity: unlocked ? 1 : 0.5,
                          display: 'flex', gap: 10, alignItems: 'center',
                        }}
                      >
                        <div style={{ fontSize: 22, flexShrink: 0 }}>{tablerIcon(ICON_REMAP[a.icon] || a.icon, 22, unlocked ? col : '#BECBD9')}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: unlocked ? col : '#BECBD9' }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: '#9AAABF', marginTop: 2 }}>{a.desc}</div>
                        </div>
                        {unlocked && <div style={{ marginLeft: 'auto', color: '#6EE7B7', fontSize: 14, flexShrink: 0 }}>{'check'}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#BECBD9' }}>No player data linked yet.</div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ───────────────────────────────────────────────────────── */}
        {tab === 'history' && (
          <Panel style={{ overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', background: '#0A0F1A', borderBottom: '1px solid rgba(242,237,228,.07)' }}>
              <h3 style={{ fontSize: 15, color: '#F2EDE4', margin: 0 }}>Clash History</h3>
            </div>
            {linkedPlayer && (linkedPlayer.clashHistory || []).length > 0 ? (
              (linkedPlayer.clashHistory || []).map(function(g, i) {
                var place = g.place || g.placement;
                var isFirst = place === 1;
                var isTop4 = place <= 4;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: '1px solid rgba(242,237,228,.05)' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: isFirst ? 'rgba(232,168,56,.12)' : isTop4 ? 'rgba(82,196,124,.08)' : 'rgba(255,255,255,.03)',
                      border: '1px solid ' + (isFirst ? 'rgba(232,168,56,.4)' : isTop4 ? 'rgba(82,196,124,.25)' : 'rgba(242,237,228,.08)'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800,
                      color: isFirst ? '#E8A838' : isTop4 ? '#6EE7B7' : '#BECBD9',
                      flexShrink: 0,
                    }}>
                      {'#' + place}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F2EDE4' }}>
                        {isFirst ? 'Victory' : isTop4 ? 'Top 4 Finish' : 'Outside Top 4'}
                        {g.clutch && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: '#9B72CF', fontWeight: 700 }}>
                            {tablerIcon('bolt', 11)} Clutch
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#BECBD9', marginTop: 2 }}>
                        R1: #{g.r1} - R2: #{g.r2} - R3: #{g.r3}
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: '#E8A838' }}>{(g.pts || '-') + 'pts'}</div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9AAABF' }}>No clash history yet.</div>
            )}
          </Panel>
        )}

      </div>
    </PageLayout>
  );
}
