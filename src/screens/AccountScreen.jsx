import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { getStats, ACHIEVEMENTS, MILESTONES, WEEKLY_CHALLENGES, DAILY_CHALLENGES, isHotStreak } from '../lib/stats.js'
import { rc, avgCol, shareToTwitter, buildShareText } from '../lib/utils.js'
import { supabase, CANONICAL_ORIGIN } from '../lib/supabase.js'
import { activateSubscription, TIER_LABELS } from '../lib/paypal.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Icon, Inp } from '../components/ui'
import Sparkline from '../components/shared/Sparkline'
import PlacementDistribution from '../components/shared/PlacementDistribution'

// ─── Shared components ──────────────────────────────────���─────────────────────

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
  var setSubscriptions = ctx.setSubscriptions;
  var passwordRecovery = ctx.passwordRecovery;
  var setPasswordRecovery = ctx.setPasswordRecovery;
  var navigate = useNavigate();
  var location = useLocation();

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
  var [subscription, setSubscription] = useState(null);

  var _newPw = useState('');
  var newPw = _newPw[0]; var setNewPw = _newPw[1];
  var _confirmPw = useState('');
  var confirmPw = _confirmPw[0]; var setConfirmPw = _confirmPw[1];
  var _pwSaving = useState(false);
  var pwSaving = _pwSaving[0]; var setPwSaving = _pwSaving[1];
  var _pwError = useState('');
  var pwError = _pwError[0]; var setPwError = _pwError[1];

  var _riotIdEu = useState(currentUser ? (currentUser.riot_id_eu || currentUser.riotId || '') : '');
  var riotIdEu = _riotIdEu[0]; var setRiotIdEu = _riotIdEu[1];
  var _riotIdNa = useState(currentUser ? (currentUser.riot_id_na || '') : '');
  var riotIdNa = _riotIdNa[0]; var setRiotIdNa = _riotIdNa[1];
  var _riotIdError = useState('');
  var riotIdError = _riotIdError[0]; var setRiotIdError = _riotIdError[1];

  var _notifPrefs = useState(function() {
    try {
      var raw = localStorage.getItem('tft-notif-prefs');
      return raw ? JSON.parse(raw) : { clashReminders: true, resultNotifs: true };
    } catch(e) {
      return { clashReminders: true, resultNotifs: true };
    }
  });
  var notifPrefs = _notifPrefs[0]; var setNotifPrefsRaw = _notifPrefs[1];

  function setNotifPref(key, val) {
    setNotifPrefsRaw(function(prev) {
      var next = Object.assign({}, prev);
      next[key] = val;
      try { localStorage.setItem('tft-notif-prefs', JSON.stringify(next)); } catch(e) {}
      return next;
    });
  }

  var _profileSaving = useState(false);
  var profileSaving = _profileSaving[0]; var setProfileSaving = _profileSaving[1];

  var _changePw = useState('');
  var changePw = _changePw[0]; var setChangePw = _changePw[1];
  var _changePwConfirm = useState('');
  var changePwConfirm = _changePwConfirm[0]; var setChangePwConfirm = _changePwConfirm[1];
  var _changePwError = useState('');
  var changePwError = _changePwError[0]; var setChangePwError = _changePwError[1];
  var _changePwSaving = useState(false);
  var changePwSaving = _changePwSaving[0]; var setChangePwSaving = _changePwSaving[1];

  var usernameChanged = !!(user.user_metadata && user.user_metadata.username_changed);
  var riotIdSet = !!(riotIdEu || riotIdNa);

  var linkedPlayer = players.find(function(p) {
    if (user.auth_user_id && p.auth_user_id && p.auth_user_id === user.auth_user_id) return true;
    if (p.authUserId && p.authUserId === user.id) return true;
    if (p.id === user.linkedPlayerId) return true;
    if (p.name && user.username && p.name.toLowerCase() === user.username.toLowerCase()) return true;
    return false;
  });

  var s = linkedPlayer ? getStats(linkedPlayer) : null;
  var rankColor = linkedPlayer ? rc(linkedPlayer.rank) : '#9B72CF';
  var subTier = subscription ? (subscription.tier || subscription.plan || 'free') : 'free';
  var isActiveSub = subscription && subscription.status === 'active';
  var isPro = isActiveSub && (subTier === 'pro' || subTier === 'bundle' || subTier === 'host');

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
    supabase.from('user_subscriptions').select('*').eq('user_id', user.auth_user_id || user.id).single()
      .then(function(res) { if (res.data && res.data.status === 'active') setSubscription(res.data); }).catch(function() {});
  }, [user && user.id]);

  // Handle PayPal checkout return: /account?checkout=success&tier=pro
  // Writes as 'pending' - webhook will set 'active' once PayPal confirms payment.
  useEffect(function() {
    var params = new URLSearchParams(location.search);
    var checkout = params.get('checkout');
    var tier = params.get('tier');
    var validTiers = ['pro', 'scrim', 'bundle', 'host'];
    if (checkout !== 'success' || !tier || validTiers.indexOf(tier) === -1 || !user || !user.id) return;
    var authId = user.auth_user_id || user.id;
    activateSubscription(supabase, authId, tier)
      .then(function(sub) {
        setSubscription(sub);
        if (setSubscriptions && user.id) {
          setSubscriptions(function(prev) {
            var merged = Object.assign({}, prev || {});
            merged[user.id] = sub;
            return merged;
          });
        }
        toast('Payment received - your ' + (TIER_LABELS[tier] || tier) + ' subscription is being activated.', 'success');
        navigate('/account', { replace: true });
      })
      .catch(function() {
        toast('Payment received - it may take a moment to activate.', 'info');
        navigate('/account', { replace: true });
      });
  }, [location.search]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setScreen('home');
      navigate('/');
      toast('Logged out successfully', 'info');
    } catch(e) {
      toast('Logout failed', 'error');
    }
  }

  async function save() {
    if (!usernameChanged && !usernameEdit.trim()) {
      toast('Username cannot be empty', 'error');
      return;
    }
    var euErr = validateRiotId(riotIdEu);
    var naErr = validateRiotId(riotIdNa);
    if (euErr || naErr) {
      setRiotIdError(euErr || naErr);
      return;
    }
    setRiotIdError('');
    setProfileSaving(true);

    var meta = Object.assign({}, user.user_metadata || {}, {
      bio: bio,
      twitch: twitch,
      twitter: twitter,
      youtube: youtube,
      profilePic: profilePic,
      bannerUrl: bannerUrl,
      profileAccent: profileAccent,
    });

    if (!usernameChanged && usernameEdit.trim() && usernameEdit.trim() !== user.username) {
      meta.username = usernameEdit.trim();
      meta.username_changed = true;
    }

    // Use EU Riot ID as the primary Riot ID for the verification section
    if (riotIdEu.trim()) {
      meta.riotId = riotIdEu.trim();
      meta.riotIdSet = true;
    }

    try {
      await supabase.auth.updateUser({ data: meta });
    } catch(e) {
      setProfileSaving(false);
      toast('Failed to save profile - please try again', 'error');
      return;
    }

    var socialLinks = { twitch: meta.twitch || '', twitter: meta.twitter || '', youtube: meta.youtube || '' };
    var derivedRegion = riotIdEu.trim() ? 'EUW' : riotIdNa.trim() ? 'NA' : (user.region || 'EUW');
    var playerUpdate = { bio: meta.bio || '', region: derivedRegion, social_links: socialLinks, riot_id_eu: riotIdEu.trim() || null, riot_id_na: riotIdNa.trim() || null, riot_id: riotIdEu.trim() || riotIdNa.trim() || null };
    if (!usernameChanged && meta.username) {
      playerUpdate.username = meta.username;
    }
    var authUid = user.auth_user_id || user.id;
    supabase.from('players').update(playerUpdate).eq('auth_user_id', authUid).then(function(pRes) {
      if (pRes.error) {
        toast('Profile saved but some data may not have synced', 'error');
      } else {
        var newUsername = playerUpdate.username || user.username;
        setUsernameEdit(newUsername);
        setPlayers(function(ps) {
          return ps.map(function(p) {
            if ((p.auth_user_id && user.auth_user_id && p.auth_user_id === user.auth_user_id) || (p.authUserId && p.authUserId === user.id)) {
              return Object.assign({}, p, {
                bio: playerUpdate.bio,
                region: playerUpdate.region,
                twitch: socialLinks.twitch,
                twitter: socialLinks.twitter,
                youtube: socialLinks.youtube,
                riot_id_eu: playerUpdate.riot_id_eu,
                riot_id_na: playerUpdate.riot_id_na,
                riotId: playerUpdate.riot_id || p.riotId,
                username: newUsername,
                name: newUsername,
              });
            }
            return p;
          });
        });
      }
    }).then(function(pRes) {
      if (!pRes || pRes.error) return;
      var updated = Object.assign({}, user, meta, {
        username: meta.username || user.username,
        user_metadata: meta,
        region: derivedRegion,
        mainRegion: derivedRegion,
        profilePic: profilePic,
        bannerUrl: bannerUrl,
        profileAccent: profileAccent,
        riot_id_eu: riotIdEu.trim() || null,
        riot_id_na: riotIdNa.trim() || null,
      });
      setCurrentUser(updated);
      setProfileSaving(false);
      setEdit(false);
      toast('Profile updated', 'success');
    }).catch(function() { setProfileSaving(false); toast('Profile save failed', 'error'); });
  }

  async function requestChange(field) {
    var pending = ((user.user_metadata && user.user_metadata.pending_changes) || []).concat([{ field: field, requestedAt: new Date().toISOString() }]);
    try { await supabase.auth.updateUser({ data: Object.assign({}, user.user_metadata || {}, { pending_changes: pending }) }); } catch(e) { /* ignore */ }
    toast('Change request submitted - an admin will review it', 'success');
  }

  async function handleSetNewPassword() {
    setPwError('');
    if (!newPw.trim()) { setPwError('Please enter a new password'); return; }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    setPwSaving(true);
    var res = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (res.error) { setPwError('Failed to update password: ' + res.error.message); return; }
    setPasswordRecovery(false);
    setNewPw('');
    setConfirmPw('');
    toast('Password updated! Please sign in again.', 'success');
    await supabase.auth.signOut();
    setCurrentUser(null);
    navigate('/login');
  }

  async function handleChangePassword() {
    setChangePwError('');
    if (!changePw.trim()) { setChangePwError('Please enter a new password'); return; }
    if (changePw.length < 8) { setChangePwError('Password must be at least 8 characters'); return; }
    if (changePw !== changePwConfirm) { setChangePwError('Passwords do not match'); return; }
    setChangePwSaving(true);
    var res = await supabase.auth.updateUser({ password: changePw });
    setChangePwSaving(false);
    if (res.error) { setChangePwError('Failed to update password: ' + res.error.message); return; }
    setChangePw('');
    setChangePwConfirm('');
    toast('Password updated successfully', 'success');
  }

  if (!user || !user.id) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Icon name="account_circle" size={48} className="text-on-surface/30 mb-4" />
          <h2 className="font-serif text-2xl text-on-surface mb-3">Sign in to view your account</h2>
          <Btn variant="primary" onClick={function() { setScreen('login'); navigate('/login'); }}>Sign In</Btn>
        </div>
      </PageLayout>
    );
  }

  var seasonRank = linkedPlayer
    ? ([...players].sort(function(a, b) { return b.pts - a.pts; }).findIndex(function(p) { return p.id === linkedPlayer.id; }) + 1)
    : null;

  var avatarInitial = (user.username || 'U').charAt(0).toUpperCase();
  var riotIdDisplay = riotIdEu || riotIdNa || '';
  var riotRegionDisplay = riotIdEu ? 'EUW' : riotIdNa ? 'NA' : (user.region || 'EUW');

  if (passwordRecovery) {
    return (
      <PageLayout>
        <div className="max-w-md mx-auto px-8 py-24">
          <Panel padding="spacious">
            <div className="flex items-center gap-3 mb-6">
              <Icon name="lock_reset" size={28} className="text-primary" />
              <h2 className="font-serif text-2xl text-on-surface">Set New Password</h2>
            </div>
            <p className="text-sm text-on-surface/60 mb-6">
              Enter a new password for your account. You will be signed out after saving.
            </p>
            <div className="space-y-4">
              <div>
                <label className="font-label text-xs uppercase tracking-widest text-on-surface/70 block mb-2">New Password</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={function(e) { setNewPw(e.target.value); if (pwError) setPwError(''); }}
                  placeholder="Enter new password"
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-3 text-sm text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="font-label text-xs uppercase tracking-widest text-on-surface/70 block mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={function(e) { setConfirmPw(e.target.value); if (pwError) setPwError(''); }}
                  placeholder="Confirm new password"
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-3 text-sm text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              {pwError && (
                <p className="text-error text-xs font-label uppercase tracking-wide">{pwError}</p>
              )}
              <Btn
                variant="primary"
                onClick={handleSetNewPassword}
                disabled={pwSaving}
                loading={pwSaving}
                className="w-full"
              >
                {pwSaving ? 'Saving' : 'Save New Password'}
              </Btn>
            </div>
          </Panel>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-8 py-12">

        {/* Page Header */}
        <header className="mb-12">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-editorial italic text-5xl md:text-6xl text-on-surface mb-2">Account Settings</h1>
              <p className="text-on-surface/60 font-body max-w-2xl">
                Manage your competitive identity, link external accounts, and customize your presence in the Obsidian Arena.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {linkedPlayer && (
                <Btn
                  variant="secondary"
                  size="sm"
                  icon="share"
                  onClick={function() {
                    shareToTwitter(buildShareText('profile', { name: user.username, rank: seasonRank, pts: linkedPlayer.pts }));
                  }}
                >
                  Share
                </Btn>
              )}
              <Btn
                variant="destructive"
                size="sm"
                icon="logout"
                onClick={handleLogout}
              >
                Sign Out
              </Btn>
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
                className={'pb-4 border-b-2 font-label uppercase tracking-[0.2em] text-sm transition-colors ' + (tab === v ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface/40 hover:text-on-surface')}
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
          {(function() {
            var tierNames = { free: 'Free Plan', pro: 'Pro', scrim: 'Scrim Pass', bundle: 'Pro + Scrim', host: 'Host' };
            var tierIcons = { free: 'person', pro: 'star', scrim: 'meeting_room', bundle: 'verified', host: 'shield_person' };
            var tierDescs = { free: 'Compete in weekly clashes. Upgrade for custom profiles and hosting.', pro: 'Custom profile, Pro badge, and premium features', scrim: 'Create scrim rooms, multi-lobby seeding, scrim stats', bundle: 'All Pro and Scrim Pass features combined', host: 'Full tournament hosting access + all Pro and Scrim features' };
            var isHost = subTier === 'host';
            var isPaid = subTier !== 'free';
            var accentClass = isHost ? 'text-tertiary' : 'text-primary';
            var iconBg = isHost ? 'bg-tertiary/20' : isPaid ? 'bg-primary/20' : 'bg-surface-container';
            var iconColor = isHost ? 'text-tertiary' : isPaid ? 'text-primary' : 'text-on-surface/40';

            return (
              <Panel padding="tight" className="flex items-center gap-4">
                <div className={'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ' + iconBg}>
                  <Icon name={tierIcons[subTier] || 'person'} size={20} className={iconColor} fill={true} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={'font-label font-bold uppercase tracking-widest text-sm ' + (isPaid ? accentClass : 'text-on-surface')}>
                      {tierNames[subTier] || 'Free Plan'}
                    </span>
                    {isPaid ? (
                      <span className="bg-success/20 text-success rounded-full px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest">Active</span>
                    ) : null}
                    {subscription && subscription.cancel_at_period_end ? (
                      <span className="bg-error/20 text-error rounded-full px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-widest">Cancels at period end</span>
                    ) : null}
                  </div>
                  <p className="text-on-surface/50 text-xs font-body mt-0.5">
                    {tierDescs[subTier] || tierDescs.free}
                  </p>
                  {subscription && subscription.current_period_end ? (
                    <p className="text-on-surface/30 text-[10px] font-mono mt-1">
                      {'Next billing: ' + new Date(subscription.current_period_end).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>
                <Btn
                  variant={isPaid ? 'ghost' : 'primary'}
                  size="sm"
                  onClick={function() { setScreen('pricing'); navigate('/pricing'); }}
                >
                  {isPaid ? 'Manage' : 'Upgrade'}
                </Btn>
              </Panel>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

            {/* Profile Identity Card */}
            <Panel padding="spacious" className="md:col-span-8 relative overflow-hidden">
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
                          var authId = user.auth_user_id || user.authUserId || user.id;
                          supabase.storage.from('avatars').upload(authId + '/avatar.png', file, { upsert: true })
                            .then(function(res) {
                              if (res.error) { toast('Upload failed', 'error'); return; }
                              var url = supabase.storage.from('avatars').getPublicUrl(authId + '/avatar.png').data.publicUrl;
                              setProfilePic(url);
                              supabase.from('players').update({ profile_pic_url: url }).eq('auth_user_id', authId).then(function() {
                                setPlayers(function(ps) {
                                  return ps.map(function(p) {
                                    if ((p.authUserId && p.authUserId === authId) || (p.auth_user_id && p.auth_user_id === authId)) {
                                      return Object.assign({}, p, { profilePicUrl: url });
                                    }
                                    return p;
                                  });
                                });
                              }).catch(function() {});
                              toast('Avatar updated!', 'success');
                            }).catch(function() { toast('Upload failed', 'error'); });
                        }}
                      />
                    </label>
                  ) : (
                    <button
                      onClick={function() { setEdit(true); }}
                      className="absolute -bottom-2 -right-2 bg-surface-container-highest p-2 rounded-full border border-outline-variant hover:bg-primary hover:text-on-primary transition-all"
                    >
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
                          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">
                            Username {usernameChanged && <span className="text-secondary/70">(locked)</span>}
                          </label>
                          {usernameChanged ? (
                            <div className="flex gap-2 items-center">
                              <div className="flex-1 bg-surface-container-lowest border-0 border-b border-outline-variant/30 p-3 text-on-surface/50 text-sm font-body">{user.username}</div>
                              <Btn
                                variant="secondary"
                                size="sm"
                                className="flex-shrink-0"
                                onClick={function() { requestChange('username'); }}
                              >
                                Request
                              </Btn>
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
                          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">Email Address</label>
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
                        <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">Bio / Tagline</label>
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

                      {/* Appearance - Pro only */}
                      <div className="pt-4 border-t border-outline-variant/10">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface">Appearance</span>
                          {isPro ? (
                            <span className="bg-primary text-on-primary rounded-full px-2 py-0.5 text-[9px] font-bold font-label uppercase">PRO</span>
                          ) : (
                            <span className="text-on-surface/30 text-xs font-label">(Pro feature)</span>
                          )}
                        </div>

                        {isPro ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">Profile Picture</label>
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
                                        var authId2 = user.auth_user_id || user.authUserId || user.id;
                                        var path = authId2 + '/avatar.' + ext;
                                        supabase.storage.from('avatars').upload(path, file, { upsert: true }).then(function(res) {
                                          if (res.error) { toast('Upload failed: ' + res.error.message, 'error'); return; }
                                          var urlResult = supabase.storage.from('avatars').getPublicUrl(path);
                                          setProfilePic(urlResult.data.publicUrl);
                                          supabase.from('players').update({ profile_pic_url: urlResult.data.publicUrl }).eq('auth_user_id', authId2).then(function() {
                                            setPlayers(function(ps) {
                                              return ps.map(function(p) {
                                                if ((p.authUserId && p.authUserId === authId2) || (p.auth_user_id && p.auth_user_id === authId2)) {
                                                  return Object.assign({}, p, { profilePicUrl: urlResult.data.publicUrl });
                                                }
                                                return p;
                                              });
                                            });
                                          }).catch(function() {});
                                          toast('Photo uploaded!', 'success');
                                        }).catch(function() { toast('Upload failed', 'error'); });
                                      }}
                                    />
                                  </label>
                                </div>
                                <div className="flex-1 space-y-1">
                                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/30">Or paste URL</label>
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
                              <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">Banner Image</label>
                              {bannerUrl && <div className="h-16 rounded border border-outline-variant/20" style={{ background: 'url(' + bannerUrl + ') center/cover' }} />}
                              <label className="flex items-center gap-3 bg-surface-container border border-outline-variant/20 rounded px-4 py-3 cursor-pointer hover:bg-surface-container-high transition-colors">
                                <Icon name="photo_camera" size={18} className="text-on-surface/60" />
                                <span className="font-label text-xs uppercase tracking-widest text-on-surface/60">Upload Banner</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={function(e) {
                                    var file = e.target.files[0];
                                    if (!file) return;
                                    if (file.size > 5 * 1024 * 1024) { toast('Max 5MB per banner', 'error'); return; }
                                    var ext = file.name.split('.').pop();
                                    var authId3 = user.auth_user_id || user.authUserId || user.id;
                                    var path = authId3 + '/banner.' + ext;
                                    supabase.storage.from('avatars').upload(path, file, { upsert: true }).then(function(res) {
                                      if (res.error) { toast('Upload failed: ' + res.error.message, 'error'); return; }
                                      var urlResult = supabase.storage.from('avatars').getPublicUrl(path);
                                      setBannerUrl(urlResult.data.publicUrl);
                                      toast('Banner uploaded!', 'success');
                                    }).catch(function() { toast('Upload failed', 'error'); });
                                  }}
                                />
                              </label>
                              <div className="space-y-1">
                                <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/30">Or paste URL</label>
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
                              <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">Profile Accent Color</label>
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
                            <div className="font-label text-sm font-bold text-primary mb-1">Unlock Profile Customization</div>
                            <p className="text-on-surface/50 text-xs mb-3">Set a custom avatar, banner, and accent color.</p>
                            <Btn
                              variant="primary"
                              size="sm"
                              onClick={function() { setScreen('pricing'); navigate('/pricing'); setEdit(false); }}
                            >
                              Go Pro - EUR 4.99/mo
                            </Btn>
                          </div>
                        )}
                      </div>

                      {/* Save / Cancel */}
                      <div className="flex justify-end gap-3 pt-2">
                        <Btn
                          variant="secondary"
                          size="sm"
                          onClick={function() { setEdit(false); }}
                        >
                          Cancel
                        </Btn>
                        <Btn
                          variant="primary"
                          size="sm"
                          onClick={save}
                          disabled={profileSaving}
                          loading={profileSaving}
                        >
                          {profileSaving ? 'Saving' : 'Save Changes'}
                        </Btn>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="space-y-4">
                      {/* Username + Email display */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">Username</label>
                          <div className="flex items-center gap-2">
                            <p className="font-body text-on-surface text-sm p-3 border-b border-outline-variant/20 flex-1">{user.username}</p>
                            {isPro && (
                              <span className="bg-primary text-on-primary rounded-full px-2 py-0.5 font-label text-[9px] font-bold uppercase tracking-widest flex-shrink-0">
                                {subTier === 'host' ? 'HOST' : subTier === 'bundle' ? 'PRO+SCRIM' : subTier === 'scrim' ? 'SCRIM' : 'PRO'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">Email Address</label>
                          <p className="font-body text-on-surface/60 text-sm p-3 border-b border-outline-variant/20">{user.email}</p>
                        </div>
                      </div>

                      {/* Bio display */}
                      <div className="space-y-1">
                        <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/40">Bio / Tagline</label>
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
                            <div className="text-primary text-xs font-bold font-label uppercase tracking-widest mb-0.5">Set your Riot ID to join tournaments</div>
                            <div className="text-on-surface/50 text-xs">You need a Riot ID to register for flash tournaments.</div>
                          </div>
                        </div>
                      )}

                      {/* Subscription status */}
                      {subscription && subTier !== 'free' ? (
                        <div className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-label border ' + (subTier === 'host' ? 'bg-tertiary/[0.12] border-tertiary/40 text-tertiary' : 'bg-primary/[0.12] border-primary/40 text-primary')}>
                          {subTier === 'host' ? 'Host' : subTier === 'bundle' ? 'Pro + Scrim' : subTier === 'scrim' ? 'Scrim Pass' : 'Pro'} - Active
                        </div>
                      ) : (
                        <Btn
                          variant="link"
                          onClick={function() { setScreen('pricing'); navigate('/pricing'); }}
                        >
                          Upgrade
                        </Btn>
                      )}

                      {/* Edit button */}
                      <div className="flex justify-end">
                        <Btn
                          variant="secondary"
                          size="sm"
                          icon="edit"
                          onClick={function() { setEdit(true); }}
                        >
                          Edit Profile
                        </Btn>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            {/* Riot Accounts */}
            <Panel padding="spacious" className="md:col-span-4 flex flex-col justify-between border-l-4 border-tertiary">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-label text-sm font-bold uppercase tracking-widest">Riot Accounts</h3>
                  {riotIdSet ? (
                    <span className="bg-tertiary-container/10 text-tertiary px-2 py-1 rounded font-label text-[10px] uppercase tracking-wider font-bold">Linked</span>
                  ) : (
                    <span className="bg-surface-container border border-outline-variant/20 text-on-surface/40 px-2 py-1 rounded font-label text-[10px] uppercase tracking-wider">Not Linked</span>
                  )}
                </div>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-surface-container-lowest flex items-center justify-center rounded-lg flex-shrink-0">
                    <Icon name="sports_esports" size={24} className="text-tertiary" />
                  </div>
                  <div>
                    <div className="font-mono text-sm text-on-surface space-y-0.5">
                      {riotIdEu ? <div>{riotIdEu} <span className="text-tertiary text-[10px]">EU</span></div> : null}
                      {riotIdNa ? <div>{riotIdNa} <span className="text-primary text-[10px]">NA</span></div> : null}
                      {!riotIdEu && !riotIdNa ? <span className="text-on-surface/40">No Riot ID set</span> : null}
                    </div>
                    <div className="text-[10px] font-label text-on-surface/40 uppercase mt-1">
                      {linkedPlayer && linkedPlayer.rank ? linkedPlayer.rank : (riotIdSet ? 'Linked' : 'Required for tournaments')}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-on-surface/60 font-body mb-6">Your Riot ID is required to register for tournaments. Set your EU and/or NA account.</p>
              </div>
              <Btn
                variant={riotIdSet ? 'secondary' : 'tertiary'}
                size="md"
                className="w-full"
                onClick={function() { setEdit(true); setTab('account'); }}
              >
                {riotIdSet ? 'Update Riot ID' : 'Link Riot ID'}
              </Btn>
            </Panel>

            {/* Social Connections */}
            <Panel padding="spacious" className="md:col-span-4">
              <h3 className="font-label text-sm font-bold uppercase tracking-widest mb-8">Social Connections</h3>
              <div className="space-y-4">

                {/* Discord */}
                <div className={'flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg group' + (discordId ? ' border-l-2 border-[#5865F2]' : '')}>
                  <div className="flex items-center space-x-4">
                    <svg width="20" height="16" viewBox="0 0 71 55" fill={discordId ? '#5865F2' : 'rgba(228,225,236,0.3)'} xmlns="http://www.w3.org/2000/svg">
                      <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.22.22 0 0 0-.23.11 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.83-3.7.23.23 0 0 0-.23-.11A58.3 58.3 0 0 0 10.9 4.9a.21.21 0 0 0-.1.08C1.58 18.73-.96 32.16.3 45.43a.24.24 0 0 0 .09.17 58.8 58.8 0 0 0 17.7 8.95.23.23 0 0 0 .25-.09 42 42 0 0 0 3.62-5.89.23.23 0 0 0-.12-.31 38.7 38.7 0 0 1-5.52-2.63.23.23 0 0 1-.02-.38c.37-.28.74-.57 1.1-.86a.22.22 0 0 1 .23-.03c11.58 5.29 24.12 5.29 35.56 0a.22.22 0 0 1 .23.03c.36.29.73.58 1.1.86a.23.23 0 0 1-.02.38 36.3 36.3 0 0 1-5.52 2.63.23.23 0 0 0-.13.31 47.2 47.2 0 0 0 3.62 5.89c.06.09.17.12.26.09a58.7 58.7 0 0 0 17.71-8.95.23.23 0 0 0 .09-.16c1.48-15.32-2.48-28.64-10.5-40.45a.18.18 0 0 0-.09-.09ZM23.7 37.3c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.82 7.15-6.37 7.15Zm23.58 0c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.79 7.15-6.37 7.15Z"/>
                    </svg>
                    <div>
                      <span className="font-body text-sm text-on-surface">Discord</span>
                      {discordName && <div className="font-label text-[10px] text-on-surface/40 uppercase">{discordName}</div>}
                    </div>
                  </div>
                  {discordId ? (
                    <Btn
                      variant="link"
                      className="text-error/70 hover:text-error hover:no-underline"
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
                    >
                      Disconnect
                    </Btn>
                  ) : (
                    <Btn
                      variant="link"
                      onClick={async function() { await supabase.auth.linkIdentity({ provider: 'discord', options: { redirectTo: CANONICAL_ORIGIN + '#account' } }); }}
                    >
                      Connect
                    </Btn>
                  )}
                </div>

                {/* Twitch */}
                <div className={'flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg group' + (((user.user_metadata && user.user_metadata.twitch) || user.twitch) ? ' border-l-2 border-secondary' : '')}>
                  <div className="flex items-center space-x-4">
                    <Icon name="videogame_asset" size={24} fill={true} className="text-on-surface/40 group-hover:text-secondary transition-colors" />
                    <div>
                      <span className="font-body text-sm text-on-surface">Twitch</span>
                      {((user.user_metadata && user.user_metadata.twitch) || user.twitch) && (
                        <div className="font-label text-[10px] text-on-surface/40 uppercase">{(user.user_metadata && user.user_metadata.twitch) || user.twitch}</div>
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
                    <Btn variant="link" onClick={function() { setEdit(true); }}>
                      {((user.user_metadata && user.user_metadata.twitch) || user.twitch) ? 'Edit' : 'Connect'}
                    </Btn>
                  )}
                </div>

                {/* Twitter / X */}
                <div className={'flex items-center justify-between p-4 bg-surface-container-lowest rounded-lg group' + (((user.user_metadata && user.user_metadata.twitter) || user.twitter) ? ' border-l-2 border-primary' : '')}>
                  <div className="flex items-center space-x-4">
                    <Icon name="share" size={24} className="text-on-surface/40 group-hover:text-primary transition-colors" />
                    <div>
                      <span className="font-body text-sm text-on-surface">Twitter / X</span>
                      {((user.user_metadata && user.user_metadata.twitter) || user.twitter) && (
                        <div className="font-label text-[10px] text-on-surface/40 uppercase">{'@' + ((user.user_metadata && user.user_metadata.twitter) || user.twitter)}</div>
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
                    <Btn variant="link" onClick={function() { setEdit(true); }}>
                      {((user.user_metadata && user.user_metadata.twitter) || user.twitter) ? 'Edit' : 'Connect'}
                    </Btn>
                  )}
                </div>

              </div>
            </Panel>

            {/* Riot Accounts (detailed) */}
            <div className="md:col-span-4">
              <Panel padding="none">
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

                  <div className="flex justify-end pt-2">
                    <Btn
                      variant="primary"
                      size="sm"
                      onClick={save}
                      disabled={profileSaving}
                      loading={profileSaving}
                    >
                      {profileSaving ? 'Saving' : 'Save Riot IDs'}
                    </Btn>
                  </div>

                </div>
              </Panel>
            </div>

            {/* Custom Banner */}
            <Panel padding="spacious" className="md:col-span-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-label text-sm font-bold uppercase tracking-widest">Custom Banner</h3>
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
                        <span className="font-label text-[10px] uppercase tracking-widest text-primary">Active Banner</span>
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
                        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface/20">Locked</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <Btn variant="primary" size="md" onClick={save}>
                      Save Changes
                    </Btn>
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
                          <div key={item.label} className="relative h-24 rounded-lg overflow-hidden cursor-not-allowed border border-outline-variant/10 bg-surface-container-lowest">
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                              <Icon name="lock" size={20} className="text-on-surface/20" />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface/20">{item.label}</span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={item.label} className={'relative h-24 rounded-lg overflow-hidden border group ' + (item.active ? 'border-2 border-primary cursor-pointer' : 'border-outline-variant/20 cursor-pointer opacity-50')}>
                          <div className={'w-full h-full ' + (i === 0 ? 'bg-gradient-to-br from-[#1a2a3a] to-[#0e1f2f]' : 'bg-gradient-to-br from-[#2a1a3a] to-[#1a0e2f]')} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                            <span className={'font-label text-[10px] uppercase tracking-widest ' + (item.active ? 'text-primary' : 'text-on-surface/60')}>{item.label}</span>
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
                    <Btn
                      variant="primary"
                      size="md"
                      onClick={function() { setScreen('pricing'); navigate('/pricing'); }}
                    >
                      Go Pro to Unlock
                    </Btn>
                  </div>
                </div>
              )}
            </Panel>

            {/* Competitive Stats QuickView */}
            {linkedPlayer && s ? (
              <section className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-primary/20">
                  <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Win Rate</div>
                  <div className="font-mono text-3xl text-primary">{s.top1Rate + '%'}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-tertiary/20">
                  <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Top 4 Rate</div>
                  <div className="font-mono text-3xl text-tertiary">{s.top4Rate + '%'}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-secondary/20">
                  <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Clash Trophies</div>
                  <div className="font-mono text-3xl text-secondary">{String(linkedPlayer.wins).padStart(2, '0')}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-on-surface/10">
                  <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Tournament LP</div>
                  <div className="font-mono text-3xl text-on-surface">{linkedPlayer.pts.toLocaleString()}</div>
                </div>
              </section>
            ) : linkedPlayer ? (
              <section className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-primary/20">
                  <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Clash Points</div>
                  <div className="font-mono text-3xl text-primary">{linkedPlayer.pts}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-tertiary/20">
                  <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Total Wins</div>
                  <div className="font-mono text-3xl text-tertiary">{linkedPlayer.wins}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-secondary/20">
                  <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Games</div>
                  <div className="font-mono text-3xl text-secondary">{linkedPlayer.games}</div>
                </div>
                <div className="bg-surface-container-high p-6 rounded-lg text-center border-b-2 border-on-surface/10">
                  <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 mb-2">Rank</div>
                  <div className="font-mono text-xl text-on-surface">{linkedPlayer.rank || '-'}</div>
                </div>
              </section>
            ) : null}

            {/* Notification Preferences */}
            <Panel padding="spacious" className="md:col-span-6">
              <div className="flex items-center gap-2 mb-6">
                <Icon name="notifications" size={20} className="text-primary" />
                <h3 className="font-label text-sm font-bold uppercase tracking-widest">Notification Preferences</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-outline-variant/10">
                  <div>
                    <div className="font-body text-sm text-on-surface">Clash Reminders</div>
                    <div className="text-xs text-on-surface/40 mt-0.5">Remind me before weekly clashes start</div>
                  </div>
                  <button
                    onClick={function() { setNotifPref('clashReminders', !notifPrefs.clashReminders); toast(notifPrefs.clashReminders ? 'Clash reminders off' : 'Clash reminders on', 'info'); }}
                    className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (notifPrefs.clashReminders ? 'bg-primary' : 'bg-surface-container-highest')}
                  >
                    <span className={'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ' + (notifPrefs.clashReminders ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-body text-sm text-on-surface">Result Notifications</div>
                    <div className="text-xs text-on-surface/40 mt-0.5">Notify me when tournament results are posted</div>
                  </div>
                  <button
                    onClick={function() { setNotifPref('resultNotifs', !notifPrefs.resultNotifs); toast(notifPrefs.resultNotifs ? 'Result notifications off' : 'Result notifications on', 'info'); }}
                    className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (notifPrefs.resultNotifs ? 'bg-primary' : 'bg-surface-container-highest')}
                  >
                    <span className={'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ' + (notifPrefs.resultNotifs ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </div>
              </div>
            </Panel>

            {/* Change Password */}
            <Panel padding="spacious" className="md:col-span-6">
              <div className="flex items-center gap-2 mb-6">
                <Icon name="lock_reset" size={20} className="text-primary" />
                <h3 className="font-label text-sm font-bold uppercase tracking-widest">Change Password</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 block mb-2">New Password</label>
                  <input
                    type="password"
                    value={changePw}
                    onChange={function(e) { setChangePw(e.target.value); if (changePwError) setChangePwError(''); }}
                    placeholder="Enter new password"
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-3 text-sm text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 block mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={changePwConfirm}
                    onChange={function(e) { setChangePwConfirm(e.target.value); if (changePwError) setChangePwError(''); }}
                    placeholder="Confirm new password"
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-3 text-sm text-on-surface placeholder:text-on-surface/30 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                {changePwError && (
                  <p className="text-error text-xs font-label uppercase tracking-wide">{changePwError}</p>
                )}
                <Btn
                  variant="secondary"
                  size="md"
                  className="w-full"
                  onClick={handleChangePassword}
                  disabled={changePwSaving || !changePw}
                  loading={changePwSaving}
                >
                  {changePwSaving ? 'Updating' : 'Update Password'}
                </Btn>
              </div>
            </Panel>

            {/* Danger Zone */}
            <div className="md:col-span-12">
              <Panel padding="tight" className="bg-error/5 border-error/20">
                <div className="font-label text-xs font-bold uppercase tracking-widest text-error mb-1">Danger Zone</div>
                <p className="text-on-surface/40 text-xs mb-3">Sign out of your account or permanently delete all your data.</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Btn
                    variant="secondary"
                    size="sm"
                    onClick={handleLogout}
                  >
                    Sign Out
                  </Btn>
                  <Btn
                    variant="destructive"
                    size="sm"
                    onClick={async function() {
                      if (!window.confirm('Delete your account permanently? This cannot be undone.')) return;
                      try {
                        var session = await supabase.auth.getSession();
                        var token = session.data && session.data.session && session.data.session.access_token;
                        if (!token) {
                          toast('Session expired. Please log in again to delete your account.', 'error');
                          return;
                        }
                        var resp = await fetch('/api/delete-account', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                        });
                        var result = await resp.json();
                        if (!resp.ok) {
                          toast(result.error || 'Deletion failed', 'error');
                          return;
                        }
                        if (setPlayers) {
                          setPlayers(function(ps) {
                            return ps.filter(function(p) {
                              return p.authUserId !== user.id && (p.name || '').toLowerCase() !== (user.username || '').toLowerCase();
                            });
                          });
                        }
                        await supabase.auth.signOut();
                        setCurrentUser(null);
                        navigate('/');
                        toast('Account deleted', 'info');
                      } catch(e) {
                        await supabase.auth.signOut();
                        setCurrentUser(null);
                        navigate('/');
                      }
                    }}
                  >
                    Delete Account
                  </Btn>
                </div>
              </Panel>
            </div>

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
                      <span key={tier} className="px-3 py-0.5 rounded-full text-xs font-bold font-label uppercase" style={{ background: tierCols[tier] + '22', color: tierCols[tier], border: '1px solid ' + tierCols[tier] + '44' }}>
                        {n} {tier}
                      </span>
                    );
                  })}
                </div>

                {/* Milestones progress */}
                <div className="mb-8">
                  <h3 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface mb-4">Season Milestones</h3>
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
                            <span className={'font-label text-xs font-bold uppercase tracking-widest ' + (reached ? 'text-primary' : 'text-on-surface-variant')}>{m.name}</span>
                          </div>
                          {m.pts && (
                            <div className="font-mono text-xs text-on-surface/40">{m.pts + ' pts required'}</div>
                          )}
                          <div className="text-on-surface/50 text-xs font-body">{m.reward}</div>
                          {reached && (
                            <div className="flex items-center gap-1 text-tertiary text-xs font-label uppercase tracking-widest">
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
                <h3 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface mb-4">Achievements</h3>
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
                        <Icon
                          name={a.icon === 'trophy' ? 'emoji_events' : a.icon === 'fire' || a.icon === 'flame' ? 'local_fire_department' : a.icon === 'star' ? 'star' : a.icon === 'shield' ? 'shield' : a.icon === 'target' || a.icon === 'bullseye' ? 'my_location' : 'military_tech'}
                          size={22}
                          className="flex-shrink-0"
                          style={{ color: unlocked ? col : '#9AAABF' }}
                        />
                        <div className="min-w-0">
                          <div className="font-label text-xs font-bold uppercase tracking-widest truncate" style={{ color: unlocked ? col : '#9AAABF' }}>{a.name}</div>
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
                <p className="font-label uppercase tracking-widest text-xs">No player data linked yet.</p>
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
                  <h3 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface mb-3">Daily Challenges</h3>
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
                              <span className={'font-label text-xs font-bold uppercase tracking-widest ' + (done ? 'text-tertiary' : 'text-on-surface')}>{ch.name}</span>
                            </div>
                            <span className="font-mono text-xs font-bold text-primary">{'+' + ch.xp + ' XP'}</span>
                          </div>
                          <p className="text-on-surface/50 text-xs font-body">{ch.desc}</p>
                          <div className="h-1 rounded-full bg-surface-container-highest">
                            <div className={'h-1 rounded-full transition-all ' + (done ? 'bg-tertiary' : 'bg-secondary')} style={{ width: pct + '%' }} />
                          </div>
                          <div className="text-on-surface/30 text-[10px] font-label uppercase tracking-widest">
                            {ch.progress + ' / ' + ch.goal}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Weekly Challenges */}
                <div className="mb-6">
                  <h3 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface mb-3">Weekly Challenges</h3>
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
                              <span className={'font-label text-xs font-bold uppercase tracking-widest ' + (done ? 'text-secondary' : 'text-on-surface')}>{ch.name}</span>
                            </div>
                            <span className="font-mono text-xs font-bold text-primary">{'+' + ch.xp + ' XP'}</span>
                          </div>
                          <p className="text-on-surface/50 text-xs font-body">{ch.desc}</p>
                          <div className="h-1 rounded-full bg-surface-container-highest">
                            <div className={'h-1 rounded-full transition-all ' + (done ? 'bg-secondary' : 'bg-primary')} style={{ width: pct + '%' }} />
                          </div>
                          <div className="text-on-surface/30 text-[10px] font-label uppercase tracking-widest">
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
                        <div className="font-label text-[10px] uppercase tracking-widest text-on-surface/40 mt-1">{item.l}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Sparkline */}
                {linkedPlayer.sparkline && linkedPlayer.sparkline.length > 1 && (
                  <Panel padding="tight" className="mb-4">
                    <div className="font-label text-xs font-bold uppercase tracking-widest text-on-surface/60 mb-3">Points Trend</div>
                    <Sparkline data={linkedPlayer.sparkline} color="#ffc66b" h={60} />
                  </Panel>
                )}

                <PlacementDistribution history={linkedPlayer.clashHistory || []} />

                {/* Clash History */}
                <Panel padding="none" className="overflow-hidden mt-4">
                  <div className="p-4 border-b border-outline-variant/10">
                    <h3 className="font-label text-xs font-bold uppercase tracking-widest text-on-surface">Clash History</h3>
                  </div>
                  {(linkedPlayer.clashHistory || []).length > 0 ? (
                    (linkedPlayer.clashHistory || []).map(function(g, i) {
                      var place = g.place || g.placement;
                      var isFirst = place === 1;
                      var isTop4 = place <= 4;
                      return (
                        <div key={g.clashId || ("clash-" + i)} className="flex items-center gap-4 px-4 py-3 border-b border-outline-variant/5 last:border-0">
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
                    <div className="text-center py-10 text-on-surface/30 font-label text-xs uppercase tracking-widest">No clash history yet.</div>
                  )}
                </Panel>
              </div>
            ) : (
              <div className="text-center py-16 text-on-surface/40">
                <Icon name="sports_esports" size={40} className="block mb-3" />
                <p className="font-label uppercase tracking-widest text-xs">No stats linked to your account yet.</p>
                <p className="text-on-surface/30 text-xs mt-2">Your account name must match a registered player.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </PageLayout>
  );
}
