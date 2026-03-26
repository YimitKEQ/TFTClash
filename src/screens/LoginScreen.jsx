import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase, CANONICAL_ORIGIN } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Icon } from '../components/ui'

export default function LoginScreen() {
  var ctx = useApp()
  var toast = ctx.toast
  var setCurrentUser = ctx.setCurrentUser
  var setAuthScreen = ctx.setAuthScreen
  var players = ctx.players
  var setPlayers = ctx.setPlayers

  var _email = useState('')
  var email = _email[0]
  var setEmail = _email[1]

  var _pw = useState('')
  var pw = _pw[0]
  var setPw = _pw[1]

  var _loading = useState(false)
  var loading = _loading[0]
  var setLoading = _loading[1]

  var _emailErr = useState('')
  var emailErr = _emailErr[0]
  var setEmailErr = _emailErr[1]

  var _pwErr = useState('')
  var pwErr = _pwErr[0]
  var setPwErr = _pwErr[1]

  function isValidEmail(email) {
    return email.indexOf('@') > 0 && email.indexOf('.') > email.indexOf('@');
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    var ok = true
    setEmailErr('')
    setPwErr('')

    if (!email.trim()) { setEmailErr('Email required'); ok = false }
    else if (!isValidEmail(email.trim())) { setEmailErr('Please enter a valid email address'); ok = false }
    if (!pw.trim()) { setPwErr('Password required'); ok = false }
    if (!ok) return

    setLoading(true)
    var result = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
    setLoading(false)

    if (result.error) { toast(result.error.message, 'error'); return }

    var user = result.data.user
    var loginUser = Object.assign({}, user, {
      username: user.user_metadata && user.user_metadata.username || user.email
    })

    setCurrentUser(loginUser)
    setAuthScreen(null)

    if (user && supabase.from) {
      supabase.from('players').select('id').eq('auth_user_id', user.id).maybeSingle()
        .then(function (res) {
          if (res.data) {
            // Player row exists in DB - just update authUserId on local state entries if needed
            var dbId = res.data.id
            setPlayers(function (ps) {
              return ps.map(function (p) {
                if (p.id === dbId && !p.authUserId) return Object.assign({}, p, { authUserId: user.id })
                return p
              })
            })
          } else {
            // No player row found - fetch full row or create one
            supabase.from('players').select('*').eq('auth_user_id', user.id).single()
              .then(function (fullRes) {
                if (fullRes.data) {
                  var r = fullRes.data
                  var np = {
                    id: r.id, name: r.username, username: r.username,
                    riotId: r.riot_id || '', rank: r.rank || 'Iron', region: r.region || 'EUW',
                    bio: r.bio || '', authUserId: r.auth_user_id, auth_user_id: r.auth_user_id,
                    twitch: (r.social_links && r.social_links.twitch) || '',
                    twitter: (r.social_links && r.social_links.twitter) || '',
                    youtube: (r.social_links && r.social_links.youtube) || '',
                    pts: 0, wins: 0, top4: 0, games: 0, avg: '0',
                    banned: false, dnpCount: 0, notes: '', checkedIn: false,
                    clashHistory: [], sparkline: [], bestStreak: 0, currentStreak: 0,
                    tiltStreak: 0, bestHaul: 0, attendanceStreak: 0, lastClashId: null,
                    role: 'player', sponsor: null
                  }
                  setPlayers(function (ps) { return ps.concat([np]) })
                }
              })
          }
        })
    }

    toast('Welcome back, ' + (loginUser.username || 'player') + '!', 'success')
  }

  async function handleForgotPassword() {
    if (!email.trim()) { toast('Please enter your email first', 'error'); return; }
    var res = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/account'
    });
    if (res.error) { toast('Failed to send reset email: ' + res.error.message, 'error'); return; }
    toast('Password reset email sent! Check your inbox.', 'success');
  }

  async function handleDiscordLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: CANONICAL_ORIGIN }
    })
  }

  function handleGuestLogin() {
    setCurrentUser(null)
    setAuthScreen(null)
  }

  var inputClass = 'w-full bg-surface-container-lowest border-0 border-b border-outline-variant/30 py-4 px-4 pr-12 text-sm font-mono placeholder:text-on-surface/20 rounded-none text-on-surface focus:outline-none focus:border-primary transition-all duration-300'

  return (
    <PageLayout showSidebar={false}>
      {/* Decorative background */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-secondary-container/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-primary-container/5 blur-[100px] rounded-full" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(#E4E1EC 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}
        />
      </div>

      <div className="min-h-[80vh] flex items-center justify-center py-8">
        <div className="w-full max-w-[480px] space-y-8">

          {/* Brand header */}
          <div className="text-center space-y-2">
            <h1 className="text-[#E8A838] text-4xl font-black tracking-tighter uppercase font-headline italic">
              TFT CLASH
            </h1>
            <p className="font-serif text-lg italic text-on-surface/60">Enter the Obsidian Arena</p>
          </div>

          {/* Auth card */}
          <div className="bg-surface-container-low relative overflow-hidden shadow-[0_40px_40px_rgba(0,0,0,0.4)]">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

            <div className="p-10 space-y-8">
              {/* Form header */}
              <div className="space-y-1">
                <h2 className="font-serif text-3xl font-bold">Sign In</h2>
                <p className="text-xs font-condensed uppercase tracking-widest text-on-surface/40">Secure access to competitive ladders</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Email field */}
                <div className="space-y-2">
                  <label className="font-condensed text-xs uppercase tracking-widest text-on-surface/70 block ml-1">
                    Summoner Identity
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="EMAIL OR USERNAME"
                      value={email}
                      onChange={function (e) { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
                      className={inputClass}
                    />
                    <Icon name="alternate_email" size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface/20 select-none" />
                  </div>
                  {emailErr && <p className="text-error text-xs font-condensed uppercase tracking-wide mt-1">{emailErr}</p>}
                </div>

                {/* Password field */}
                <div className="space-y-2">
                  <label className="font-condensed text-xs uppercase tracking-widest text-on-surface/70 block ml-1">
                    Security Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;"
                      value={pw}
                      onChange={function (e) { setPw(e.target.value); if (pwErr) setPwErr('') }}
                      onKeyDown={function (e) { if (e.key === 'Enter') handleSubmit() }}
                      className={inputClass}
                    />
                    <Icon name="lock" size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface/20 select-none" />
                  </div>
                  {pwErr && <p className="text-error text-xs font-condensed uppercase tracking-wide mt-1">{pwErr}</p>}
                </div>

                {/* Forgot password */}
                <div className="flex items-center justify-end py-2">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="font-condensed text-xs uppercase tracking-wider text-primary hover:text-primary-container transition-colors bg-transparent border-0 cursor-pointer p-0"
                  >
                    Forgot Access?
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary font-condensed font-bold text-sm tracking-widest uppercase rounded-full shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? 'Authenticating...' : 'Authenticate Account'}
                </button>
              </form>

              {/* Social / partner login */}
              <div className="space-y-6 pt-4">
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-outline-variant/20" />
                  <span className="px-4 font-condensed text-[10px] uppercase tracking-tighter text-on-surface/30">Partner Login</span>
                  <div className="flex-grow border-t border-outline-variant/20" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button className="flex items-center justify-center space-x-3 py-3 bg-surface-container-high/60 backdrop-blur-md border border-outline-variant/10 rounded-full hover:bg-surface-variant/40 transition-colors cursor-not-allowed opacity-50">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="opacity-80">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                    </svg>
                    <span className="font-condensed text-[10px] font-bold uppercase tracking-widest">Riot ID</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDiscordLogin}
                    className="flex items-center justify-center space-x-3 py-3 bg-[#5865F2] border border-outline-variant/10 rounded-full hover:opacity-85 transition-opacity"
                  >
                    <svg width="16" height="12" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg">
                      <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.22.22 0 0 0-.23.11 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.83-3.7.23.23 0 0 0-.23-.11A58.3 58.3 0 0 0 10.9 4.9a.21.21 0 0 0-.1.08C1.58 18.73-.96 32.16.3 45.43a.24.24 0 0 0 .09.17 58.8 58.8 0 0 0 17.7 8.95.23.23 0 0 0 .25-.09 42 42 0 0 0 3.62-5.89.23.23 0 0 0-.12-.31 38.7 38.7 0 0 1-5.52-2.63.23.23 0 0 1-.02-.38c.37-.28.74-.57 1.1-.86a.22.22 0 0 1 .23-.03c11.58 5.29 24.12 5.29 35.56 0a.22.22 0 0 1 .23.03c.36.29.73.58 1.1.86a.23.23 0 0 1-.02.38 36.3 36.3 0 0 1-5.52 2.63.23.23 0 0 0-.13.31 47.2 47.2 0 0 0 3.62 5.89c.06.09.17.12.26.09a58.7 58.7 0 0 0 17.71-8.95.23.23 0 0 0 .09-.16c1.48-15.32-2.48-28.64-10.5-40.45a.18.18 0 0 0-.09-.09ZM23.7 37.3c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.82 7.15-6.37 7.15Zm23.58 0c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.79 7.15-6.37 7.15Z" />
                    </svg>
                    <span className="font-condensed text-[10px] font-bold uppercase tracking-widest text-white">Discord</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card footer */}
            <div className="bg-surface-container-highest/30 p-6 text-center">
              <p className="text-xs font-condensed tracking-widest uppercase text-on-surface/40">
                New to the arena?{' '}
                <button
                  type="button"
                  onClick={function () { setAuthScreen('signup') }}
                  className="text-secondary font-bold hover:underline ml-1 bg-transparent border-0 cursor-pointer font-condensed text-xs tracking-widest uppercase"
                >
                  Establish Profile
                </button>
              </p>
            </div>
          </div>

          {/* Guest access */}
          <div className="text-center pb-4">
            <p className="text-xs font-condensed tracking-widest uppercase text-on-surface/40">
              Playing without an account?{' '}
              <button
                type="button"
                onClick={handleGuestLogin}
                className="text-on-surface/60 underline hover:text-on-surface bg-transparent border-0 cursor-pointer font-condensed text-xs tracking-widest uppercase"
              >
                Continue as guest
              </button>
            </p>
          </div>

        </div>
      </div>
    </PageLayout>
  )
}
