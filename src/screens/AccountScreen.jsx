import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats, ACHIEVEMENTS, MILESTONES, WEEKLY_CHALLENGES, DAILY_CHALLENGES, isHotStreak } from '../lib/stats.js'
import { rc, avgCol, shareToTwitter, buildShareText } from '../lib/utils.js'
import { supabase, CANONICAL_ORIGIN } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Icon, Inp } from '../components/ui'

// ─── Inline select component ──────────────────────────────────────────────────
function Sel({ value, onChange, children, style }) {
  return (
    <select
      value={value}
      onChange={function(e) { onChange(e.target.value); }}
      style={Object.assign({
        width: '100%',
        background: '#0e0d15',
        border: '1px solid rgba(80,69,53,.5)',
        borderRadius: 4,
        padding: '9px 12px',
        color: '#e4e1ec',
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
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color || '#ffc66b'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={(data.length - 1) / (data.length - 1) * W}
        cy={H - ((data[data.length - 1] - min) / range) * (H - 4) + 2}
        r="2.5"
        fill={color || '#ffc66b'}
      />
    </svg>
  );
}

// ─── Placement distribution bar chart ─────────────────────────────────────────
function PlacementDistribution({ history }) {
  var counts = [0, 0, 0, 0, 0, 0, 0, 0];
  (history || []).forEach(function(g) {
    var p = (g.place || g.placement || 1) - 1;
    if (p >= 0 && p < 8) counts[p]++;
  });
  var total = counts.reduce(function(s, v) { return s + v; }, 0) || 1;
  var colors = ['#ffc66b', '#C0C0C0', '#CD7F32', '#67e2d9', '#9AAABF', '#9AAABF', '#F87171', '#F87171'];

  return (
    <div className="bg-surface-container-high rounded p-4 mb-3">
      <div className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40 mb-3">Placement Distribution</div>
      {counts.map(function(count, i) {
        var pct = Math.round((count / total) * 100);
        return (
          <div key={i} className="flex items-center gap-2 mb-1.5">
            <div className="w-5 text-right text-xs font-bold flex-shrink-0" style={{ color: colors[i] }}>{'#' + (i + 1)}</div>
            <div className="flex-1 h-2 bg-surface-container-lowest rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: pct + '%', background: colors[i] }} />
            </div>
            <div className="w-5 text-right text-xs text-on-surface/50 flex-shrink-0">{count}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Riot ID validation ───────────────────────────────────────────────────────
function validateRiotId(val) {
  if (!val || !val.trim()) return '';
  var parts = val.trim().split('#');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return 'Format: GameName#TAG (e.g. Levitate#EUW)';
  }
  var name = parts[0];
  var tag = parts[1];
  if (name.length < 3 || name.length > 16) {
    return 'Game name must be 3-16 characters';
  }
  if (!/^[a-zA-Z0-9]+$/.test(tag) || tag.length < 3 || tag.length > 5) {
    return 'TAG must be 3-5 alphanumeric characters';
  }
  return '';
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

  var [tab, setTab] = useState('account');
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

  var _riotIdEu = useState(currentUser ? (currentUser.riot_id_eu || '') : '');
  var riotIdEu = _riotIdEu[0]; var setRiotIdEu = _riotIdEu[1];
  var _riotIdNa = useState(currentUser ? (currentUser.riot_id_na || '') : '');
  var riotIdNa = _riotIdNa[0]; var setRiotIdNa = _riotIdNa[1];
  var _riotIdError = useState('');
  var riotIdError = _riotIdError[0]; var setRiotIdError = _riotIdError[1];

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

  var tierCols = { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#ffc66b', legendary: '#9B72CF' };

  var acctProfileFields = [
    user.user_metadata && user.user_metadata.riot_id,
    user.user_metadata && user.user_metadata.bio,
    user.user_metadata && user.user_metadata.region,
  ];
  var acctProfileComplete = acctProfileFields.filter(Boolean).length;
  var acctProfileTotal = acctProfileFields.length;

  var discordIdent = user.identities && user.identities.find(function(i) { return i.provider === 'discord'; });
  var discordId = discordIdent && discordIdent.identity_data && discordIdent.identity_data.sub;
  var discordName = discordIdent && discordIdent.identity_data && (discordIdent.identity_data.global_name || discordIdent.identity_data.full_name);

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
    var euErr = validateRiotId(riotIdEu);
    var naErr = validateRiotId(riotIdNa);
    var mainRiotIdErr = (!riotIdSet && riotId.trim()) ? validateRiotId(riotId) : '';
    if (euErr || naErr || mainRiotIdErr) {
      setRiotIdError(euErr || naErr || mainRiotIdErr);
      return;
    }
    setRiotIdError('');

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
    var playerUpdate = { bio: meta.bio || '', region: riotRegion, social_links: socialLinks, riot_id_eu: riotIdEu.trim() || null, riot_id_na: riotIdNa.trim() || null };
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
      riot_id_eu: riotIdEu.trim() || null,
      riot_id_na: riotIdNa.trim() || null,
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
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Icon name="account_circle" size={48} className="text-on-surface/30 mb-4" />
          <h2 className="font-serif text-2xl text-on-surface mb-3">Sign in to view your account</h2>
          <Btn v="primary" onClick={function() { setScreen('login'); navigate('/login'); }}>Sign In</Btn>
        </div>
      </PageLayout>
    );
  }

  var seasonRank = linkedPlayer
    ? ([...players].sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(p) { return p.id === linkedPlayer.id; }) + 1)
    : null;

  var avatarInitial = (user.username || 'U').charAt(0).toUpperCase();
  var riotIdDisplay = user.user_metadata && (user.user_metadata.riotId || user.user_metadata.riot_id);
  var riotRegionDisplay = user.user_metadata && (user.user_metadata.riotRegion || user.user_metadata.riot_region || user.user_metadata.region);

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-8 py-12">

        {/* Page Header */}
        <header className="mb-12">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-serif text-5xl md:text-6xl text-on-surface mb-2">Account Settings</h1>
              <p className="text-on-surface/60 font-body max-w-2xl">
                Manage your competitive identity, link external accounts, and customize your presence in the Obsidian Arena.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {linkedPlayer && (
                <button
                  onClick={function() {
                    shareToTwitter(buildShareText('profile', { name: user.username, rank: seasonRank, pts: linkedPlayer.pts }));
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant/30 rounded text-on-surface/70 hover:text-on-surface font-sans-cond text-xs uppercase tracking-widest transition-colors"
                >
                  <Icon name="share" size={16} />
                  Share
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant/30 rounded text-error/70 hover:text-error font-sans-cond text-xs uppercase tracking-widest transition-colors"
              >
                <Icon name="logout" size={16} />
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="flex space-x-12 mb-10 border-b border-outline-variant/10">
          {[['account', 'Account'], ['milestones', 'Milestones'], ['challenges', 'Challenges']].map(function(item) {
            var v = item[0];
            var l = item[1];
            return (
              <button
                key={v}
                onClick={function() { setTab(v); }}
                className={'pb-4 border-b-2 font-sans-cond uppercase tracking-[0.2em] text-sm transition-colors ' + (tab === v ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface/40 hover:text-on-surface')}
              >
                {l}
              </button>
            );
          })}
        </div>

        {/* ── ACCOUNT TAB ──────────────────────────────────────────────────────── */}
        {tab === 'account' && (
          <div className="space-y-6">

          {/* Subscription Status Card */}
          {subscription ? (
            <div className={'flex items-center gap-4 p-4 rounded-lg border ' + (subscription.plan === 'host' ? 'bg-primary/8 border-primary/30' : 'bg-secondary/8 border-secondary/30')}>
              <div className={'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ' + (subscription.plan === 'host' ? 'bg-primary/20' : 'bg-secondary/20')}>
                <Icon name={subscription.plan === 'host' ? 'shield_person' : 'star'} size={20} className={subscription.plan === 'host' ? 'text-primary' : 'text-secondary'} fill={true} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={'font-condensed font-bold uppercase tracking-widest text-sm ' + (subscription.plan === 'host' ? 'text-primary' : 'text-secondary')}>
                    {subscription.plan === 'host' ? 'Host Plan' : 'Pro Plan'}
                  </span>
                  <span className="bg-success/20 text-success rounded-full px-2 py-0.5 font-condensed text-[10px] font-bold uppercase tracking-widest">Active</span>
                </div>
                <p className="text-on-surface/50 text-xs font-body mt-0.5">
                  {subscription.plan === 'host' ? 'Full tournament hosting access + all Pro features' : 'Custom profile, Pro badge, and premium features'}
                </p>
              </div>
              <button
                onClick={function() { setScreen('pricing'); navigate('/pricing'); }}
                className="flex-shrink-0 font-condensed text-xs uppercase tracking-widest text-on-surface/50 hover:text-on-surface transition-colors"
              >
                Manage
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 rounded-lg border border-outline-variant/20 bg-surface-container-low">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-surface-container">
                <Icon name="person" size={20} className="text-on-surface/40" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-condensed font-bold uppercase tracking-widest text-sm text-on-surface">Free Plan</span>
                </div>
                <p className="text-on-surface/50 text-xs font-body mt-0.5">Compete in weekly clashes. Upgrade for custom profiles and hosting.</p>
              </div>
              <button
                onClick={function() { setScreen('pricing'); navigate('/pricing'); }}
                className="flex-shrink-0 bg-primary text-on-primary px-4 py-2 rounded font-condensed text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
              >
                Upgrade
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

            {/* Profile Identity Card */}
            <section className="md:col-span-8 bg-surface-container-low rounded-lg p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
              <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">

                {/* Avatar */}
                <div className="relative group flex-shrink-0">
                  <div
                    className="w-32 h-32 rounded-lg overflow-hidden border-2 border-primary-container shadow-xl flex items-center justify-center"
                    style={{
                      background: profilePic
                        ? ('url(' + profilePic + ') center/cover no-repeat')
                        : ('linear-gradient(135deg,' + rankColor + '44,' + rankColor + '11)'),
                      color: rankColor,
                      fontSize: profilePic ? 0 : 40,
                      fontFamily: 'inherit',
                      fontWeight: 900,
                    }}
                  >
                    {!profilePic && avatarInitial}
                  </div>
                  {isPro && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary border-2 border-surface-container-low flex items-center justify-center">
                      <Icon name="star" size={11} fill={true} className="text-on-primary" />
                    </div>
                  )}
                  {isPro && edit ? (
                    <label className="absolute -bottom-2 -right-2 bg-surface-container-highest p-2 rounded-full border border-outline-variant hover:bg-primary hover:text-on-primary transition-all cursor-pointer">
                      <Icon name="edit" size={18} />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
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
                  ) : (
                    <button className="absolute -bottom-2 -right-2 bg-surface-container-highest p-2 rounded-full border border-outline-variant hover:bg-primary hover:text-on-primary transition-all">
                      <Icon name="edit" size={18} />
                    </button>
                  )}
                </div>

                {/* Fields */}
                <div className="flex-1 space-y-6 w-full">

                  {edit ? (
                    <div className="space-y-4">
                      {/* Username + Email row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40">
                            Username {usernameChanged && <span className="text-secondary/70">(locked)</span>}
                          </label>
                          {usernameChanged ? (
                            <div className="flex gap-2 items-center">
                              <div className="flex-1 bg-surface-container-lowest border-0 border-b border-outline-variant/30 p-3 text-on-surface/50 text-sm font-body">{user.username}</div>
                              <button
                                onClick={function() { requestChange('username'); }}
                                className="px-3 py-2 bg-surface-container border border-outline-variant/30 rounded font-sans-cond text-xs uppercase tracking-widest text-on-surface/60 hover:text-on-surface transition-colors flex-shrink-0"
                              >
                                Request
                              </button>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="text"
                                value={usernameEdit}
                                onChange={function(e) { setUsernameEdit(e.target.value); }}
                                placeholder="Your display name"
                                className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 focus:border-primary focus:ring-0 text-on-surface font-body p-3 transition-colors"
                              />
                              <p className="text-[11px] text-on-surface/40 mt-1">You can only change this once.</p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40">Email Address</label>
                          <input
                            type="email"
                            value={user.email || ''}
                            readOnly
                            className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 text-on-surface/60 font-body p-3 cursor-not-allowed"
                          />
                        </div>
                      </div>

                      {/* Bio */}
                      <div className="space-y-1">
                        <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40">Bio / Tagline</label>
                        <textarea
                          value={bio}
                          onChange={function(e) { setBio(e.target.value); }}
                          maxLength={160}
                          placeholder="Tell people who you are..."
                          className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 focus:border-primary focus:ring-0 text-on-surface font-body p-3 transition-colors h-24 resize-none"
                        />
                        <div className="flex justify-between">
                          <span className="text-[11px] text-on-surface/40">Max 160 characters</span>
                          <span className="text-[11px] text-on-surface/30">{bio.length}/160</span>
                        </div>
                      </div>

                      {/* Riot ID */}
                      <div className="space-y-1">
                        <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40">
                          Main Riot ID {riotIdSet && <span className="text-primary/60">(locked)</span>}
                        </label>
                        {riotIdSet ? (
                          <div className="flex gap-2 items-center">
                            <div className="flex-1 bg-surface-container-lowest border border-primary/15 rounded p-3 text-primary text-sm font-mono font-bold">
                              {(user.user_metadata && (user.user_metadata.riotId || user.user_metadata.riot_id))} - {(user.user_metadata && (user.user_metadata.riotRegion || user.user_metadata.riot_region || user.user_metadata.region)) || 'EUW'}
                            </div>
                            <button
                              onClick={function() { requestChange('riotId'); }}
                              className="px-3 py-2 bg-surface-container border border-outline-variant/30 rounded font-sans-cond text-xs uppercase tracking-widest text-on-surface/60 hover:text-on-surface transition-colors flex-shrink-0"
                            >
                              Request
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="grid grid-cols-[1fr_100px] gap-2">
                              <input
                                type="text"
                                value={riotId}
                                onChange={function(e) { setRiotId(e.target.value); if (riotIdError) setRiotIdError(''); }}
                                placeholder="GameName#TAG"
                                className={'bg-surface-container-lowest border-0 border-b focus:ring-0 text-on-surface font-body p-3 transition-colors text-sm ' + (riotIdError && riotId.trim() ? 'border-error focus:border-error' : 'border-outline-variant/30 focus:border-primary')}
                              />
                              <Sel value={riotRegion} onChange={setRiotRegion}>
                                {EU_NA.map(function(r) { return <option key={r} value={r}>{r}</option>; })}
                              </Sel>
                            </div>
                            {riotIdError && riotId.trim() && (
                              <p className="text-error text-[11px] mt-1">{riotIdError}</p>
                            )}
                            {!riotIdError && (
                              <p className="text-[11px] text-on-surface/40 mt-1">Format: GameName#TAG (e.g. Levitate#EUW)</p>
                            )}
                          </div>
                        )}
                        <p className="text-[11px] text-on-surface/40">EU and NA accounts only. Cannot be changed without admin approval.</p>
                      </div>

                      {/* Secondary Riot ID */}
                      <div className="space-y-1">
                        <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40">Secondary Riot ID <span className="text-on-surface/30">(optional)</span></label>
                        <div className="grid grid-cols-[1fr_100px] gap-2">
                          <input
                            type="text"
                            value={secondRiotId}
                            onChange={function(e) { setSecondRiotId(e.target.value); }}
                            placeholder="SecondName#TAG"
                            className="bg-surface-container-lowest border-0 border-b border-outline-variant/30 focus:border-primary focus:ring-0 text-on-surface font-body p-3 transition-colors text-sm"
                          />
                          <Sel value={secondRegion} onChange={setSecondRegion}>
                            {EU_NA.map(function(r) { return <option key={r} value={r}>{r}</option>; })}
                          </Sel>
                        </div>
                      </div>

                      {/* Appearance - Pro only */}
                      <div className="pt-4 border-t border-outline-variant/10">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="font-sans-cond text-xs font-bold uppercase tracking-widest text-on-surface">Appearance</span>
                          {isPro ? (
                            <span className="bg-primary text-on-primary rounded-full px-2 py-0.5 text-[9px] font-bold font-sans-cond uppercase">PRO</span>
                          ) : (
                            <span className="text-on-surface/30 text-xs font-sans-cond">(Pro feature)</span>
                          )}
                        </div>

                        {isPro ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40">Profile Picture</label>
                              <div className="flex items-center gap-4">
                                <div
                                  className="w-16 h-16 rounded-lg border-2 border-outline-variant/30 flex-shrink-0 overflow-hidden flex items-center justify-center relative group cursor-pointer"
                                  style={{ background: profilePic ? ('url(' + profilePic + ') center/cover no-repeat') : ('linear-gradient(135deg,' + rankColor + '44,' + rankColor + '11)') }}
                                >
                                  {!profilePic && <span className="text-2xl font-black" style={{ color: rankColor }}>{avatarInitial}</span>}
                                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-lg">
                                    <Icon name="photo_camera" size={20} className="text-white" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={function(e) {
                                        var file = e.target.files[0];
                                        if (!file) return;
                                        if (file.size > 2 * 1024 * 1024) { toast('Max 2MB per file', 'error'); return; }
                                        var ext = file.name.split('.').pop();
                                        var path = user.id + '/avatar.' + ext;
                                        supabase.storage.from('avatars').upload(path, file, { upsert: true }).then(function(res) {
                                          if (res.error) { toast('Upload failed: ' + res.error.message, 'error'); return; }
                                          var urlResult = supabase.storage.from('avatars').getPublicUrl(path);
                                          setProfilePic(urlResult.data.publicUrl);
                                          supabase.from('players').update({ profile_pic_url: urlResult.data.publicUrl }).eq('auth_user_id', user.id);
                                          toast('Photo uploaded!', 'success');
                                        });
                                      }}
                                    />
                                  </label>
                                </div>
                                <div className="flex-1 space-y-1">
                                  <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/30">Or paste URL</label>
                                  <input
                                    type="text"
                                    value={profilePic}
                                    onChange={function(e) { setProfilePic(e.target.value); }}
                                    placeholder="https://i.imgur.com/your-pic.png"
                                    className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 focus:border-primary focus:ring-0 text-on-surface font-body p-3 transition-colors text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40">Banner Image</label>
                              {bannerUrl && <div className="h-16 rounded border border-outline-variant/20" style={{ background: 'url(' + bannerUrl + ') center/cover' }} />}
                              <label className="flex items-center gap-3 bg-surface-container border border-outline-variant/20 rounded px-4 py-3 cursor-pointer hover:bg-surface-container-high transition-colors">
                                <Icon name="photo_camera" size={18} className="text-on-surface/60" />
                                <span className="font-sans-cond text-xs uppercase tracking-widest text-on-surface/60">Upload Banner</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={function(e) {
                                    var file = e.target.files[0];
                                    if (!file) return;
                                    if (file.size > 5 * 1024 * 1024) { toast('Max 5MB per banner', 'error'); return; }
                                    var ext = file.name.split('.').pop();
                                    var path = user.id + '/banner.' + ext;
                                    supabase.storage.from('avatars').upload(path, file, { upsert: true }).then(function(res) {
                                      if (res.error) { toast('Upload failed: ' + res.error.message, 'error'); return; }
                                      var urlResult = supabase.storage.from('avatars').getPublicUrl(path);
                                      setBannerUrl(urlResult.data.publicUrl);
                                      toast('Banner uploaded!', 'success');
                                    });
                                  }}
                                />
                              </label>
                              <div className="space-y-1">
                                <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/30">Or paste URL</label>
                                <input
                                  type="text"
                                  value={bannerUrl}
                                  onChange={function(e) { setBannerUrl(e.target.value); }}
                                  placeholder="https://i.imgur.com/your-banner.png"
                                  className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 focus:border-primary focus:ring-0 text-on-surface font-body p-3 transition-colors text-sm"
                                />
                                <p className="text-[11px] text-on-surface/30">Recommended: 1500x500 or similar wide aspect ratio.</p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40">Profile Accent Color</label>
                              <div className="flex gap-2 flex-wrap">
                                {['', '#9B72CF', '#ffc66b', '#67e2d9', '#F87171', '#6EE7B7', '#60A5FA', '#FB923C', '#EC4899', '#8B5CF6'].map(function(clr) {
                                  var isActive = profileAccent === clr;
                                  return (
                                    <div
                                      key={clr || 'default'}
                                      onClick={function() { setProfileAccent(clr); }}
                                      style={{ width: 26, height: 26, borderRadius: '50%', background: clr || ('linear-gradient(135deg,' + rankColor + '44,' + rankColor + '11)'), cursor: 'pointer', border: isActive ? '3px solid #fff' : '3px solid transparent', transition: 'border .15s', position: 'relative', flexShrink: 0 }}
                                    >
                                      {!clr && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#9AAABF' }}>Auto</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-primary/5 border border-primary/20 border-dashed rounded-lg p-4 text-center">
                            <div className="font-sans-cond text-sm font-bold text-primary mb-1">Unlock Profile Customization</div>
                            <p className="text-on-surface/50 text-xs mb-3">Set a custom avatar, banner, and accent color.</p>
                            <button
                              onClick={function() { setScreen('pricing'); navigate('/pricing'); setEdit(false); }}
                              className="bg-primary text-on-primary px-4 py-2 rounded font-sans-cond text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                            >
                              Go Pro - EUR 4.99/mo
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Save / Cancel */}
                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          onClick={function() { setEdit(false); }}
                          className="px-6 py-2.5 bg-surface-container border border-outline-variant/30 rounded-full font-sans-cond text-xs uppercase tracking-widest text-on-surface/60 hover:text-on-surface transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={save}
                          className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-8 py-2.5 rounded-full font-sans-cond font-bold uppercase tracking-widest text-xs hover:scale-[0.98] transition-all"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="space-y-4">
                      {/* Username + Email display */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40">Username</label>
                          <div className="flex items-center gap-2">
                            <p className="font-body text-on-surface text-sm p-3 border-b border-outline-variant/20 flex-1">{user.username}</p>
                            {isPro && (
                              <span className="bg-primary text-on-primary rounded-full px-2 py-0.5 font-sans-cond text-[9px] font-bold uppercase tracking-widest flex-shrink-0">
                                {subscription && subscription.plan === 'host' ? 'HOST' : 'PRO'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40">Email Address</label>
                          <p className="font-body text-on-surface/60 text-sm p-3 border-b border-outline-variant/20">{user.email}</p>
                        </div>
                      </div>

                      {/* Bio display */}
                      <div className="space-y-1">
                        <label className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40">Bio / Tagline</label>
                        {((user.user_metadata && user.user_metadata.bio) || user.bio) ? (
                          <p className="font-body text-on-surface text-sm p-3 border-b border-outline-variant/20 h-24 overflow-auto leading-relaxed">
                            {(user.user_metadata && user.user_metadata.bio) || user.bio}
                          </p>
                        ) : (
                          <p className="font-body text-on-surface/30 text-sm p-3 border-b border-outline-variant/20 h-24 italic">
                            No bio set yet...
                          </p>
                        )}
                      </div>

                      {/* Riot ID warning if not set */}
                      {!riotIdSet && (
                        <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded mt-2">
                          <Icon name="warning" size={18} className="text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="text-primary text-xs font-bold font-sans-cond uppercase tracking-widest mb-0.5">Set your Riot ID to join tournaments</div>
                            <div className="text-on-surface/50 text-xs">You need a Riot ID to register for flash tournaments.</div>
                          </div>
                        </div>
                      )}

                      {/* Subscription status */}
                      {subscription ? (
                        <div className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-sans-cond border ' + (subscription.plan === 'host' ? 'bg-primary/[0.12] border-primary/40 text-primary' : 'bg-secondary/[0.12] border-secondary/40 text-secondary-container')}>
                          {subscription.plan === 'host' ? 'Host Plan' : 'Pro Plan'} - Active
                        </div>
                      ) : (
                        <button
                          onClick={function() { setScreen('pricing'); navigate('/pricing'); }}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-secondary/30 text-secondary/70 hover:text-secondary text-xs font-sans-cond uppercase tracking-widest transition-colors"
                        >
                          Upgrade to Pro
                        </button>
                      )}

                      {/* Edit button */}
                      <div className="flex justify-end">
                        <button
                          onClick={function() { setEdit(true); }}
                          className="flex items-center gap-1.5 px-5 py-2 bg-surface-variant/20 border border-outline-variant/30 rounded-full font-sans-cond text-xs uppercase tracking-[0.15em] hover:bg-surface-variant transition-colors"
                        >
                          <Icon name="edit" size={16} />
                          Edit Profile
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Riot ID Verification */}
            <section className="md:col-span-4 bg-surface-container-low rounded-lg p-8 flex flex-col justify-between border-l-4 border-tertiary">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-sans-cond text-sm font-bold uppercase tracking-widest">Riot Verification</h3>
                  {riotIdSet ? (
                    <span className="bg-tertiary-container/10 text-tertiary px-2 py-1 rounded-sm font-sans-cond text-[10px] uppercase tracking-wider font-bold">Verified</span>
                  ) : (
                    <span className="bg-surface-container border border-outline-variant/20 text-on-surface/40 px-2 py-1 rounded-sm font-sans-cond text-[10px] uppercase tracking-wider">Unverified</span>
                  )}
                </div>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-surface-container-lowest flex items-center justify-center rounded-lg flex-shrink-0">
                    <Icon name="shield_person" size={24} className="text-tertiary" />
                  </div>
                  <div>
                    <div className="font-mono text-lg text-on-surface">
                      {riotIdDisplay ? (riotIdDisplay + (riotRegionDisplay ? '#' + riotRegionDisplay : '')) : 'Not linked'}
                    </div>
                    <div className="text-[10px] font-sans-cond text-on-surface/40 uppercase">
                      {linkedPlayer && linkedPlayer.rank ? linkedPlayer.rank : (riotIdSet ? 'Linked' : 'No account linked')}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-on-surface/60 font-body mb-6">Your Riot ID is used to fetch match history and calculate competitive standings.</p>
              </div>
              {riotIdSet ? (
                <button
                  onClick={function() { requestChange('riotId'); }}
                  className="w-full bg-surface-variant/20 border border-outline-variant/30 py-3 rounded-full font-sans-cond text-xs uppercase tracking-[0.15em] hover:bg-surface-variant transition-colors"
                >
                  Update Riot ID
                </button>
              ) : (
                <button
                  onClick={function() { setEdit(true); setTab('account'); }}
                  className="w-full bg-tertiary/10 border border-tertiary/30 text-tertiary py-3 rounded-full font-sans-cond text-xs uppercase tracking-[0.15em] hover:bg-tertiary/20 transition-colors"
                >
                  Link Riot ID
                </button>
              )}
            </section>

            {/* Social Connections */}
            <section className="md:col-span-4 bg-surface-container-low rounded-lg p-8">
              <h3 className="font-sans-cond text-sm font-bold uppercase tracking-widest mb-8">Social Connections</h3>
              <div className="space-y-4">

                {/* Discord */}
                <div className={'flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg group' + (discordId ? ' border-l-2 border-[#5865F2]' : '')}>
                  <div className="flex items-center space-x-4">
                    <svg width="20" height="16" viewBox="0 0 71 55" fill={discordId ? '#5865F2' : 'rgba(228,225,236,0.3)'} xmlns="http://www.w3.org/2000/svg">
                      <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.22.22 0 0 0-.23.11 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.83-3.7.23.23 0 0 0-.23-.11A58.3 58.3 0 0 0 10.9 4.9a.21.21 0 0 0-.1.08C1.58 18.73-.96 32.16.3 45.43a.24.24 0 0 0 .09.17 58.8 58.8 0 0 0 17.7 8.95.23.23 0 0 0 .25-.09 42 42 0 0 0 3.62-5.89.23.23 0 0 0-.12-.31 38.7 38.7 0 0 1-5.52-2.63.23.23 0 0 1-.02-.38c.37-.28.74-.57 1.1-.86a.22.22 0 0 1 .23-.03c11.58 5.29 24.12 5.29 35.56 0a.22.22 0 0 1 .23.03c.36.29.73.58 1.1.86a.23.23 0 0 1-.02.38 36.3 36.3 0 0 1-5.52 2.63.23.23 0 0 0-.13.31 47.2 47.2 0 0 0 3.62 5.89c.06.09.17.12.26.09a58.7 58.7 0 0 0 17.71-8.95.23.23 0 0 0 .09-.16c1.48-15.32-2.48-28.64-10.5-40.45a.18.18 0 0 0-.09-.09ZM23.7 37.3c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.82 7.15-6.37 7.15Zm23.58 0c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.79 7.15-6.37 7.15Z"/>
                    </svg>
                    <div>
                      <span className="font-body text-sm text-on-surface">Discord</span>
                      {discordName && <div className="font-sans-cond text-[10px] text-on-surface/40 uppercase">{discordName}</div>}
                    </div>
                  </div>
                  {discordId ? (
                    <button
                      onClick={async function() {
                        if (!window.confirm('Disconnect Discord? You will need a password to log in.')) return;
                        try {
                          await supabase.auth.unlinkIdentity(discordIdent);
                          toast('Discord disconnected', 'success');
                          handleLogout();
                        } catch(e) {
                          toast('Could not disconnect: ' + e.message, 'error');
                        }
                      }}
                      className="text-error/60 hover:text-error font-sans-cond text-[10px] uppercase tracking-widest transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={async function() { await supabase.auth.linkIdentity({ provider: 'discord', options: { redirectTo: CANONICAL_ORIGIN + '#account' } }); }}
                      className="text-primary font-sans-cond text-xs uppercase tracking-widest font-bold"
                    >
                      Connect
                    </button>
                  )}
                </div>

                {/* Twitch */}
                <div className={'flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg group' + (((user.user_metadata && user.user_metadata.twitch) || user.twitch) ? ' border-l-2 border-secondary' : '')}>
                  <div className="flex items-center space-x-4">
                    <Icon name="videogame_asset" size={24} fill={true} className="text-on-surface/40 group-hover:text-secondary transition-colors" />
                    <div>
                      <span className="font-body text-sm text-on-surface">Twitch</span>
                      {((user.user_metadata && user.user_metadata.twitch) || user.twitch) && (
                        <div className="font-sans-cond text-[10px] text-on-surface/40 uppercase">{(user.user_metadata && user.user_metadata.twitch) || user.twitch}</div>
                      )}
                    </div>
                  </div>
                  {edit ? (
                    <input
                      type="text"
                      value={twitch}
                      onChange={function(e) { setTwitch(e.target.value); }}
                      placeholder="username"
                      className="w-28 bg-surface-container border border-outline-variant/20 rounded px-2 py-1 text-xs text-on-surface font-body focus:border-primary focus:ring-0 transition-colors"
                    />
                  ) : (
                    <button onClick={function() { setEdit(true); }} className="text-primary font-sans-cond text-xs uppercase tracking-widest font-bold">
                      {((user.user_metadata && user.user_metadata.twitch) || user.twitch) ? 'Edit' : 'Connect'}
                    </button>
                  )}
                </div>

                {/* Twitter / X */}
                <div className={'flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg group' + (((user.user_metadata && user.user_metadata.twitter) || user.twitter) ? ' border-l-2 border-primary' : '')}>
                  <div className="flex items-center space-x-4">
                    <Icon name="share" size={24} className="text-on-surface/40 group-hover:text-primary transition-colors" />
                    <div>
                      <span className="font-body text-sm text-on-surface">Twitter / X</span>
                      {((user.user_metadata && user.user_metadata.twitter) || user.twitter) && (
                        <div className="font-sans-cond text-[10px] text-on-surface/40 uppercase">{'@' + ((user.user_metadata && user.user_metadata.twitter) || user.twitter)}</div>
                      )}
                    </div>
                  </div>
                  {edit ? (
                    <input
                      type="text"
                      value={twitter}
                      onChange={function(e) { setTwitter(e.target.value); }}
                      placeholder="@handle"
                      className="w-28 bg-surface-container border border-outline-variant/20 rounded px-2 py-1 text-xs text-on-surface font-body focus:border-primary focus:ring-0 transition-colors"
                    />
                  ) : (
                    <button onClick={function() { setEdit(true); }} className="text-primary font-sans-cond text-xs uppercase tracking-widest font-bold">
                      {((user.user_metadata && user.user_metadata.twitter) || user.twitter) ? 'Edit' : 'Connect'}
                    </button>
                  )}
                </div>

              </div>
            </section>

            {/* Riot Accounts */}
            <section className="md:col-span-4 bg-surface-container-low rounded-lg p-8">
              <Panel className="mt-4">
                <div className="flex items-center gap-2 p-4 border-b border-white/[0.05]">
                  <Icon name="sports_esports" size={18} className="text-primary" />
                  <span className="font-label text-sm font-bold uppercase tracking-wide">Riot Accounts</span>
                </div>
                <div className="p-4 flex flex-col gap-4">

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                      EU Riot ID
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-tertiary/10 text-tertiary border border-tertiary/20">EU</span>
                    </div>
                    <Inp
                      value={riotIdEu}
                      onChange={function(e) { setRiotIdEu(e.target.value); setRiotIdError(''); }}
                      placeholder="Username#EUW"
                    />
                    {riotIdEu
                      ? <div className="flex items-center gap-1 text-[11px] text-tertiary"><Icon name="check_circle" size={14} />Linked - used for EU clash weeks</div>
                      : <div className="flex items-center gap-1 text-[11px] text-primary"><Icon name="warning" size={14} />Not linked - you cannot register for EU weeks</div>
                    }
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                      NA Riot ID
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">NA</span>
                    </div>
                    <Inp
                      value={riotIdNa}
                      onChange={function(e) { setRiotIdNa(e.target.value); setRiotIdError(''); }}
                      placeholder="Username#NA1"
                    />
                    {riotIdNa
                      ? <div className="flex items-center gap-1 text-[11px] text-tertiary"><Icon name="check_circle" size={14} />Linked - used for NA clash weeks</div>
                      : <div className="flex items-center gap-1 text-[11px] text-primary"><Icon name="warning" size={14} />Not linked - you cannot register for NA weeks</div>
                    }
                  </div>

                  {riotIdError && <div className="text-[11px] text-error">{riotIdError}</div>}

                </div>
              </Panel>
            </section>

            {/* Custom Banner */}
            <section className="md:col-span-8 bg-surface-container-low rounded-lg p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-sans-cond text-sm font-bold uppercase tracking-widest">Custom Banner</h3>
                {isPro ? (
                  <span className="font-mono text-[10px] text-primary/60 uppercase">Premium Unlocks: Active</span>
                ) : (
                  <span className="font-mono text-[10px] text-on-surface/30 uppercase">Premium Unlocks: Locked</span>
                )}
              </div>

              {isPro ? (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Active banner */}
                    <div className="relative h-24 rounded-lg overflow-hidden cursor-pointer border-2 border-primary group">
                      <div
                        className="w-full h-full"
                        style={{ background: bannerUrl ? ('url(' + bannerUrl + ') center/cover') : ('linear-gradient(135deg,' + (profileAccent || rankColor) + '88,#13131a 80%)') }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                        <span className="font-sans-cond text-[10px] uppercase tracking-widest text-primary">Active Banner</span>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Icon name="check_circle" size={16} fill={true} className="text-primary" />
                      </div>
                    </div>
                    {/* Placeholder unlocked slots */}
                    <div className="relative h-24 rounded-lg overflow-hidden cursor-pointer border border-outline-variant/20 group bg-surface-container-lowest flex items-center justify-center">
                      <Icon name="add_photo_alternate" size={32} className="text-on-surface/20" />
                    </div>
                    {/* Locked slot */}
                    <div className="relative h-24 rounded-lg overflow-hidden cursor-not-allowed border border-outline-variant/10 group bg-surface-container-lowest">
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                        <Icon name="lock" size={20} className="text-on-surface/20" />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                        <span className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/20">Locked</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button
                      onClick={save}
                      className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-8 py-3 rounded-full font-sans-cond font-bold uppercase tracking-widest text-xs hover:scale-[0.98] transition-all"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {/* Preview locked banners */}
                    {[
                      { label: 'Obsidian Current', active: true },
                      { label: 'Nebula Strike', active: false },
                      { label: 'Void Walker', locked: true },
                    ].map(function(item, i) {
                      if (item.locked) {
                        return (
                          <div key={i} className="relative h-24 rounded-lg overflow-hidden cursor-not-allowed border border-outline-variant/10 bg-surface-container-lowest">
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                              <Icon name="lock" size={20} className="text-on-surface/20" />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                              <span className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/20">{item.label}</span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={i} className={'relative h-24 rounded-lg overflow-hidden border group ' + (item.active ? 'border-2 border-primary cursor-pointer' : 'border-outline-variant/20 cursor-pointer opacity-50')}>
                          <div className={'w-full h-full ' + (i === 0 ? 'bg-gradient-to-br from-[#1a2a3a] to-[#0e1f2f]' : 'bg-gradient-to-br from-[#2a1a3a] to-[#1a0e2f]')} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                            <span className={'font-sans-cond text-[10px] uppercase tracking-widest ' + (item.active ? 'text-primary' : 'text-on-surface/60')}>{item.label}</span>
                          </div>
                          {item.active && (
                            <div className="absolute top-2 right-2">
                              <Icon name="lock" size={16} fill={true} className="text-primary" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={function() { setScreen('pricing'); navigate('/pricing'); }}
                      className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-8 py-3 rounded-full font-sans-cond font-bold uppercase tracking-widest text-xs hover:scale-[0.98] transition-all"
                    >
                      Go Pro to Unlock
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Competitive Stats QuickView */}
            {linkedPlayer && s ? (
              <section className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-primary/20">
                  <div className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Win Rate</div>
                  <div className="font-mono text-3xl text-primary">{s.top1Rate + '%'}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-tertiary/20">
                  <div className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Top 4 Rate</div>
                  <div className="font-mono text-3xl text-tertiary">{s.top4Rate + '%'}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-secondary/20">
                  <div className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Clash Trophies</div>
                  <div className="font-mono text-3xl text-secondary">{String(linkedPlayer.wins).padStart(2, '0')}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-on-surface/10">
                  <div className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Tournament LP</div>
                  <div className="font-mono text-3xl text-on-surface">{linkedPlayer.pts.toLocaleString()}</div>
                </div>
              </section>
            ) : linkedPlayer ? (
              <section className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-primary/20">
                  <div className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Clash Points</div>
                  <div className="font-mono text-3xl text-primary">{linkedPlayer.pts}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-tertiary/20">
                  <div className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Total Wins</div>
                  <div className="font-mono text-3xl text-tertiary">{linkedPlayer.wins}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-secondary/20">
                  <div className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Games</div>
                  <div className="font-mono text-3xl text-secondary">{linkedPlayer.games}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-on-surface/10">
                  <div className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Rank</div>
                  <div className="font-mono text-xl text-on-surface">{linkedPlayer.rank || '-'}</div>
                </div>
              </section>
            ) : null}

            {/* Danger Zone */}
            <section className="md:col-span-12">
              <div className="bg-error/5 border border-error/20 rounded-lg p-5">
                <div className="font-sans-cond text-xs font-bold uppercase tracking-widest text-error mb-1">Danger Zone</div>
                <p className="text-on-surface/40 text-xs mb-3">Permanently delete your account and all data. This cannot be undone.</p>
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
                  className="px-4 py-2 bg-error/10 border border-error/40 rounded font-sans-cond text-xs font-bold uppercase tracking-widest text-error hover:bg-error/20 transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </section>

          </div>
          </div>
        )}

        {/* ── MILESTONES TAB ───────────────────────────────────────────────────── */}
        {tab === 'milestones' && (
          <div>
            {linkedPlayer ? (
              <div>
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                  <span className="font-serif text-xl text-on-surface">{myAchievements.length} of {ACHIEVEMENTS.length} unlocked</span>
                  {['legendary', 'gold', 'silver', 'bronze'].map(function(tier) {
                    var n = myAchievements.filter(function(a) { return a.tier === tier; }).length;
                    if (!n) return null;
                    return (
                      <span key={tier} className="px-3 py-0.5 rounded-full text-xs font-bold font-sans-cond uppercase" style={{ background: tierCols[tier] + '22', color: tierCols[tier], border: '1px solid ' + tierCols[tier] + '44' }}>
                        {n} {tier}
                      </span>
                    );
                  })}
                </div>

                {/* Milestones progress */}
                <div className="mb-8">
                  <h3 className="font-sans-cond text-xs font-bold uppercase tracking-widest text-on-surface mb-4">Season Milestones</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {MILESTONES.map(function(m) {
                      var reached = false;
                      try { reached = m.check(linkedPlayer); } catch(e) { reached = false; }
                      return (
                        <div
                          key={m.id}
                          className={'p-4 rounded-lg border flex flex-col gap-2 ' + (reached ? 'bg-primary/[0.07] border-primary/35' : 'bg-white/[0.02] border-white/[0.06] opacity-[0.55]')}
                        >
                          <div className="flex items-center gap-2">
                            <span className={reached ? 'text-primary' : 'text-on-surface-variant'}><Icon name={reached ? 'emoji_events' : 'military_tech'} size={18} /></span>
                            <span className={'font-sans-cond text-xs font-bold uppercase tracking-widest ' + (reached ? 'text-primary' : 'text-on-surface-variant')}>{m.name}</span>
                          </div>
                          {m.pts && (
                            <div className="font-mono text-xs text-on-surface/40">{m.pts + ' pts required'}</div>
                          )}
                          <div className="text-on-surface/50 text-xs font-body">{m.reward}</div>
                          {reached && (
                            <div className="flex items-center gap-1 text-tertiary text-xs font-sans-cond uppercase tracking-widest">
                              <Icon name="check_circle" size={14} />
                              Reached
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Achievements */}
                <h3 className="font-sans-cond text-xs font-bold uppercase tracking-widest text-on-surface mb-4">Achievements</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ACHIEVEMENTS.map(function(a) {
                    var unlocked = false;
                    try { unlocked = a.check(linkedPlayer); } catch(e) { unlocked = false; }
                    var col = tierCols[a.tier];
                    return (
                      <div
                        key={a.id}
                        className="flex gap-3 items-center p-4 rounded-lg border transition-opacity"
                        style={{
                          background: unlocked ? col + '11' : 'rgba(255,255,255,.02)',
                          border: '1px solid ' + (unlocked ? col + '44' : 'rgba(228,225,236,.06)'),
                          opacity: unlocked ? 1 : 0.5,
                        }}
                      >
                        <span
                          className="material-symbols-outlined flex-shrink-0"
                          style={{ color: unlocked ? col : '#9AAABF', fontSize: 22 }}
                        >
                          {a.icon === 'trophy' ? 'emoji_events' : a.icon === 'fire' || a.icon === 'flame' ? 'local_fire_department' : a.icon === 'star' ? 'star' : a.icon === 'shield' ? 'shield' : a.icon === 'target' || a.icon === 'bullseye' ? 'my_location' : 'military_tech'}
                        </span>
                        <div className="min-w-0">
                          <div className="font-sans-cond text-xs font-bold uppercase tracking-widest truncate" style={{ color: unlocked ? col : '#9AAABF' }}>{a.name}</div>
                          <div className="text-on-surface/40 text-xs font-body mt-0.5">{a.desc}</div>
                        </div>
                        {unlocked && <Icon name="check_circle" size={16} fill={true} className="text-tertiary ml-auto flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-on-surface/40">
                <Icon name="military_tech" size={40} className="block mb-3" />
                <p className="font-sans-cond uppercase tracking-widest text-xs">No player data linked yet.</p>
              </div>
            )}
          </div>
        )}

        {/* ── CHALLENGES TAB ───────────────────────────────────────────────────── */}
        {tab === 'challenges' && (
          <div>
            {linkedPlayer ? (
              <div>
                <div className="mb-6">
                  <p className="text-on-surface/50 text-sm font-body">Complete challenges to earn rewards and recognition in the arena.</p>
                </div>

                {/* Daily Challenges */}
                <div className="mb-6">
                  <h3 className="font-sans-cond text-xs font-bold uppercase tracking-widest text-on-surface mb-3">Daily Challenges</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {DAILY_CHALLENGES.map(function(ch) {
                      var pct = ch.goal > 0 ? Math.min(100, Math.round((ch.progress / ch.goal) * 100)) : 0;
                      var done = ch.progress >= ch.goal;
                      return (
                        <div
                          key={ch.id}
                          className={'p-4 rounded-lg border flex flex-col gap-2 ' + (done ? 'bg-tertiary/[0.07] border-tertiary/35' : 'bg-white/[0.02] border-white/[0.08]')}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={done ? 'text-tertiary' : 'text-on-surface-variant'}><Icon name="bolt" size={16} /></span>
                              <span className={'font-sans-cond text-xs font-bold uppercase tracking-widest ' + (done ? 'text-tertiary' : 'text-on-surface')}>{ch.name}</span>
                            </div>
                            <span className="font-mono text-xs font-bold text-primary">{'+' + ch.xp + ' XP'}</span>
                          </div>
                          <p className="text-on-surface/50 text-xs font-body">{ch.desc}</p>
                          <div className="h-1 rounded-full bg-surface-container-highest">
                            <div className={'h-1 rounded-full transition-all ' + (done ? 'bg-tertiary' : 'bg-secondary')} style={{ width: pct + '%' }} />
                          </div>
                          <div className="text-on-surface/30 text-[10px] font-sans-cond uppercase tracking-widest">
                            {ch.progress + ' / ' + ch.goal}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Weekly Challenges */}
                <div className="mb-6">
                  <h3 className="font-sans-cond text-xs font-bold uppercase tracking-widest text-on-surface mb-3">Weekly Challenges</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {WEEKLY_CHALLENGES.map(function(ch) {
                      var pct = ch.goal > 0 ? Math.min(100, Math.round((ch.progress / ch.goal) * 100)) : 0;
                      var done = ch.progress >= ch.goal;
                      return (
                        <div
                          key={ch.id}
                          className={'p-4 rounded-lg border flex flex-col gap-2 ' + (done ? 'bg-secondary/[0.07] border-secondary/35' : 'bg-white/[0.02] border-white/[0.08]')}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={done ? 'text-secondary' : 'text-on-surface-variant'}><Icon name="calendar_month" size={16} /></span>
                              <span className={'font-sans-cond text-xs font-bold uppercase tracking-widest ' + (done ? 'text-secondary' : 'text-on-surface')}>{ch.name}</span>
                            </div>
                            <span className="font-mono text-xs font-bold text-primary">{'+' + ch.xp + ' XP'}</span>
                          </div>
                          <p className="text-on-surface/50 text-xs font-body">{ch.desc}</p>
                          <div className="h-1 rounded-full bg-surface-container-highest">
                            <div className={'h-1 rounded-full transition-all ' + (done ? 'bg-secondary' : 'bg-primary')} style={{ width: pct + '%' }} />
                          </div>
                          <div className="text-on-surface/30 text-[10px] font-sans-cond uppercase tracking-widest">
                            {ch.progress + ' / ' + ch.goal}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    { l: 'Clash Points', v: linkedPlayer.pts, c: '#ffc66b' },
                    { l: 'Total Wins', v: linkedPlayer.wins, c: '#67e2d9' },
                    { l: 'Top 4 Rate', v: s ? (s.top4Rate + '%') : '-', c: '#d9b9ff' },
                    { l: 'Avg Placement', v: s ? s.avgPlacement : '-', c: s ? avgCol(s.avgPlacement) : '#9AAABF' },
                    { l: 'Games Played', v: linkedPlayer.games, c: '#67e2d9' },
                    { l: 'Best Streak', v: linkedPlayer.bestStreak, c: '#F87171' },
                    { l: 'PPG', v: s ? s.ppg : '-', c: '#ffc66b' },
                    { l: 'Clutch Rate', v: s ? (s.clutchRate + '%') : '-', c: '#9B72CF' },
                  ].map(function(item) {
                    return (
                      <div key={item.l} className="bg-surface-container-high p-4 rounded-lg text-center">
                        <div className="font-mono text-2xl font-bold" style={{ color: item.c }}>{item.v}</div>
                        <div className="font-sans-cond text-[10px] uppercase tracking-widest text-on-surface/40 mt-1">{item.l}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Sparkline */}
                {linkedPlayer.sparkline && linkedPlayer.sparkline.length > 1 && (
                  <div className="bg-surface-container-low rounded-lg p-5 mb-4">
                    <div className="font-sans-cond text-xs font-bold uppercase tracking-widest text-on-surface/60 mb-3">Points Trend</div>
                    <Sparkline data={linkedPlayer.sparkline} color="#ffc66b" h={60} />
                  </div>
                )}

                <PlacementDistribution history={linkedPlayer.clashHistory || []} />

                {/* Clash History */}
                <div className="bg-surface-container-low rounded-lg overflow-hidden mt-4">
                  <div className="p-4 border-b border-outline-variant/10">
                    <h3 className="font-sans-cond text-xs font-bold uppercase tracking-widest text-on-surface">Clash History</h3>
                  </div>
                  {(linkedPlayer.clashHistory || []).length > 0 ? (
                    (linkedPlayer.clashHistory || []).map(function(g, i) {
                      var place = g.place || g.placement;
                      var isFirst = place === 1;
                      var isTop4 = place <= 4;
                      return (
                        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-outline-variant/5 last:border-0">
                          <div
                            className={'w-9 h-9 rounded flex items-center justify-center text-sm font-bold flex-shrink-0 font-mono border ' + (isFirst ? 'bg-primary/[0.12] border-primary/40 text-primary' : isTop4 ? 'bg-tertiary/[0.08] border-tertiary/25 text-tertiary' : 'bg-white/[0.03] border-white/[0.08] text-on-surface-variant')}
                          >
                            {'#' + place}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-body text-on-surface font-medium">
                              {isFirst ? 'Victory' : isTop4 ? 'Top 4 Finish' : 'Outside Top 4'}
                            </div>
                            <div className="text-xs text-on-surface/40 mt-0.5">
                              {'R1: #' + g.r1 + ' - R2: #' + g.r2 + ' - R3: #' + g.r3}
                            </div>
                          </div>
                          <div className="font-mono text-sm font-bold text-primary flex-shrink-0">{(g.pts || '-') + ' pts'}</div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 text-on-surface/30 font-sans-cond text-xs uppercase tracking-widest">No clash history yet.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-on-surface/40">
                <Icon name="sports_esports" size={40} className="block mb-3" />
                <p className="font-sans-cond uppercase tracking-widest text-xs">No stats linked to your account yet.</p>
                <p className="text-on-surface/30 text-xs mt-2">Your account name must match a registered player.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </PageLayout>
  );
}
