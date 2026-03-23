import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase, CANONICAL_ORIGIN } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Inp, Divider } from '../components/ui'

export default function SignUpScreen() {
  var ctx = useApp()
  var toast = ctx.toast
  var setCurrentUser = ctx.setCurrentUser
  var setAuthScreen = ctx.setAuthScreen
  var setPlayers = ctx.setPlayers
  var setShowOnboarding = ctx.setShowOnboarding

  var _email = useState('')
  var email = _email[0]
  var setEmail = _email[1]

  var _pw = useState('')
  var pw = _pw[0]
  var setPw = _pw[1]

  var _pw2 = useState('')
  var pw2 = _pw2[0]
  var setPw2 = _pw2[1]

  var _username = useState('')
  var username = _username[0]
  var setUsername = _username[1]

  var _loading = useState(false)
  var loading = _loading[0]
  var setLoading = _loading[1]

  var _emailErr = useState('')
  var emailErr = _emailErr[0]
  var setEmailErr = _emailErr[1]

  var _usernameErr = useState('')
  var usernameErr = _usernameErr[0]
  var setUsernameErr = _usernameErr[1]

  var _pwErr = useState('')
  var pwErr = _pwErr[0]
  var setPwErr = _pwErr[1]

  var _pw2Err = useState('')
  var pw2Err = _pw2Err[0]
  var setPw2Err = _pw2Err[1]

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    var ok = true
    setEmailErr('')
    setUsernameErr('')
    setPwErr('')
    setPw2Err('')

    if (!email.trim()) { setEmailErr('Email required'); ok = false }
    if (!username.trim()) { setUsernameErr('Username required'); ok = false }
    if (!pw.trim() || pw.length < 6) {
      setPwErr(!pw.trim() ? 'Password required' : 'Must be 6+ characters')
      ok = false
    }
    if (pw !== pw2) { setPw2Err("Passwords don't match"); ok = false }
    if (!ok) return

    setLoading(true)
    var result = await supabase.auth.signUp({
      email: email.trim(),
      password: pw,
      options: { data: { username: username.trim() } }
    })
    setLoading(false)

    if (result.error) { toast(result.error.message, 'error'); return }

    // Insert into DB players table with auth_user_id link
    var authUserId = result.data.user ? result.data.user.id : null
    var dbInsert = await supabase.from('players').insert({
      username: username.trim(),
      rank: 'Iron',
      auth_user_id: authUserId
    }).select().single()

    if (dbInsert.error && dbInsert.error.code !== '23505') {
      console.error('[TFT] Failed to create player row:', dbInsert.error)
    }

    // Add to local players state immediately so linkedPlayer works
    var newPlayer = {
      id: dbInsert.data ? dbInsert.data.id : (Date.now() % 100000),
      name: username.trim(), username: username.trim(),
      riotId: '', rank: 'Iron', region: 'EUW',
      bio: '', authUserId: authUserId,
      pts: 0, wins: 0, top4: 0, games: 0, avg: '0',
      banned: false, dnpCount: 0, notes: '', checkedIn: false,
      clashHistory: [], sparkline: [], bestStreak: 0, currentStreak: 0,
      tiltStreak: 0, bestHaul: 0, attendanceStreak: 0, lastClashId: null,
      role: 'player', sponsor: null
    }
    if (setPlayers) setPlayers(function (ps) { return ps.concat([newPlayer]) })

    var signedUpUser = Object.assign({}, result.data.user, { username: username.trim() })
    setCurrentUser(signedUpUser)
    setAuthScreen(null)
    setShowOnboarding(true)

    toast('Welcome to TFT Clash, ' + username.trim() + '!', 'success')
  }

  async function handleDiscordSignUp() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: CANONICAL_ORIGIN }
    })
  }

  return (
    <PageLayout showSidebar={false}>
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-[480px] space-y-8">
          {/* Brand header */}
          <div className="text-center space-y-2">
            <h1 className="text-primary text-4xl font-black tracking-tighter uppercase font-headline italic">
              TFT CLASH
            </h1>
            <p className="font-serif text-lg italic text-on-surface/60">Join the Obsidian Arena</p>
          </div>

          {/* Auth card */}
          <div className="bg-surface-container-low relative overflow-hidden shadow-[0_40px_40px_rgba(0,0,0,0.4)]">
            {/* Decorative top accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

            <div className="p-10 space-y-8">
              {/* Form header */}
              <div className="space-y-1">
                <h2 className="font-serif text-3xl font-bold">Create Account</h2>
                <p className="text-xs font-sans uppercase tracking-widest text-on-surface/40">Establish your competitive profile</p>
              </div>

              {/* Discord signup */}
              <button
                onClick={handleDiscordSignUp}
                className="w-full flex items-center justify-center space-x-3 py-3 bg-[#5865F2] border-0 rounded-full hover:opacity-85 transition-opacity cursor-pointer"
              >
                <svg width="16" height="12" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.22.22 0 0 0-.23.11 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.83-3.7.23.23 0 0 0-.23-.11A58.3 58.3 0 0 0 10.9 4.9a.21.21 0 0 0-.1.08C1.58 18.73-.96 32.16.3 45.43a.24.24 0 0 0 .09.17 58.8 58.8 0 0 0 17.7 8.95.23.23 0 0 0 .25-.09 42 42 0 0 0 3.62-5.89.23.23 0 0 0-.12-.31 38.7 38.7 0 0 1-5.52-2.63.23.23 0 0 1-.02-.38c.37-.28.74-.57 1.1-.86a.22.22 0 0 1 .23-.03c11.58 5.29 24.12 5.29 35.56 0a.22.22 0 0 1 .23.03c.36.29.73.58 1.1.86a.23.23 0 0 1-.02.38 36.3 36.3 0 0 1-5.52 2.63.23.23 0 0 0-.13.31 47.2 47.2 0 0 0 3.62 5.89c.06.09.17.12.26.09a58.7 58.7 0 0 0 17.71-8.95.23.23 0 0 0 .09-.16c1.48-15.32-2.48-28.64-10.5-40.45a.18.18 0 0 0-.09-.09ZM23.7 37.3c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.82 7.15-6.37 7.15Zm23.58 0c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.79 7.15-6.37 7.15Z" /></svg>
                <span className="font-sans text-xs font-bold uppercase tracking-widest text-white">Sign up with Discord</span>
              </button>

              <Divider label="or with email" />

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Inp
                    label="Email"
                    icon="alternate_email"
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={function (e) { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
                  />
                  {emailErr && <p className="text-error text-sm mt-1">{emailErr}</p>}
                </div>

                <div>
                  <Inp
                    label="Username"
                    icon="person"
                    type="text"
                    placeholder="Your display name"
                    value={username}
                    onChange={function (e) { setUsername(e.target.value); if (usernameErr) setUsernameErr('') }}
                  />
                  {usernameErr && <p className="text-error text-sm mt-1">{usernameErr}</p>}
                </div>

                <div>
                  <Inp
                    label="Password"
                    icon="lock"
                    type="password"
                    placeholder="6+ characters"
                    value={pw}
                    onChange={function (e) { setPw(e.target.value); if (pwErr) setPwErr('') }}
                  />
                  {pwErr && <p className="text-error text-sm mt-1">{pwErr}</p>}
                </div>

                <div>
                  <Inp
                    label="Confirm Password"
                    icon="lock"
                    type="password"
                    placeholder="Repeat password"
                    value={pw2}
                    onChange={function (e) { setPw2(e.target.value); if (pw2Err) setPw2Err('') }}
                    onKeyDown={function (e) { if (e.key === 'Enter') handleSubmit() }}
                  />
                  {pw2Err && <p className="text-error text-sm mt-1">{pw2Err}</p>}
                </div>

                <Btn variant="primary" size="xl" type="submit" disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </Btn>
              </form>
            </div>

            {/* Footer */}
            <div className="bg-surface-container-highest/30 p-6 text-center">
              <p className="text-xs font-sans tracking-widest uppercase text-on-surface/40">
                Already have an account?{' '}
                <button
                  onClick={function () { setAuthScreen('login') }}
                  className="text-secondary font-bold hover:underline ml-1 bg-transparent border-0 cursor-pointer font-sans text-xs tracking-widest uppercase"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
