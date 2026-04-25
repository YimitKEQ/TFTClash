import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase, CANONICAL_ORIGIN } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Icon } from '../components/ui'

export default function SignUpScreen() {
  var ctx = useApp()
  var toast = ctx.toast
  var setAuthScreen = ctx.setAuthScreen
  var currentUser = ctx.currentUser
  var navTo = ctx.navTo

  var tosState = useState(false)
  var tos = tosState[0]
  var setTos = tosState[1]

  // If already logged in, close signup and show welcome-back toast
  useEffect(function() {
    if (currentUser) {
      toast('Welcome back, ' + (currentUser.username || 'player') + '! You are already signed in.', 'info')
      setAuthScreen(null)
    }
  }, [currentUser ? currentUser.id : null])

  async function handleDiscordSignUp() {
    if (!tos) {
      toast('Please accept the Terms and Privacy Policy first', 'error')
      return
    }
    var res = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: CANONICAL_ORIGIN }
    })
    if (res.error) { toast(res.error.message, 'error') }
  }

  return (
    <PageLayout showSidebar={false}>
      <div className="min-h-[80vh] flex items-center justify-center py-8">
        <div className="w-full max-w-[420px] space-y-6">

          {/* Brand header */}
          <div className="text-center space-y-2">
            <h1 className="text-primary text-4xl font-display tracking-tighter uppercase leading-none">
              TFT CLASH
            </h1>
            <p className="font-editorial text-base text-on-surface/50 italic">Your leaderboard spot is free. Always.</p>
          </div>

          {/* Auth panel */}
          <Panel className="p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-on-surface">Join the Arena</h2>
              <p className="text-xs font-label uppercase tracking-widest text-on-surface/40">Free to compete, every week</p>
            </div>

            {/* Terms acceptance */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tos}
                onChange={function(e) { setTos(e.target.checked) }}
                className="mt-0.5 w-4 h-4 rounded border border-outline-variant/40 bg-surface-container text-primary focus:ring-2 focus:ring-primary/40 cursor-pointer flex-shrink-0"
              />
              <span className="text-xs text-on-surface/70 leading-relaxed">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={function() { navTo('terms') }}
                  className="text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer font-bold"
                >Terms of Service</button>
                {' '}and{' '}
                <button
                  type="button"
                  onClick={function() { navTo('privacy') }}
                  className="text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer font-bold"
                >Privacy Policy</button>.
              </span>
            </label>

            {/* Discord button */}
            <button
              type="button"
              disabled={!tos}
              onClick={handleDiscordSignUp}
              className={'w-full flex items-center justify-center gap-3 py-3.5 bg-[#5865F2] border-0 rounded-lg active:scale-[0.98] transition-all ' + (tos ? 'hover:bg-[#4752C4] cursor-pointer' : 'opacity-50 cursor-not-allowed')}
            >
              <svg width="20" height="15" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.22.22 0 0 0-.23.11 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.83-3.7.23.23 0 0 0-.23-.11A58.3 58.3 0 0 0 10.9 4.9a.21.21 0 0 0-.1.08C1.58 18.73-.96 32.16.3 45.43a.24.24 0 0 0 .09.17 58.8 58.8 0 0 0 17.7 8.95.23.23 0 0 0 .25-.09 42 42 0 0 0 3.62-5.89.23.23 0 0 0-.12-.31 38.7 38.7 0 0 1-5.52-2.63.23.23 0 0 1-.02-.38c.37-.28.74-.57 1.1-.86a.22.22 0 0 1 .23-.03c11.58 5.29 24.12 5.29 35.56 0a.22.22 0 0 1 .23.03c.36.29.73.58 1.1.86a.23.23 0 0 1-.02.38 36.3 36.3 0 0 1-5.52 2.63.23.23 0 0 0-.13.31 47.2 47.2 0 0 0 3.62 5.89c.06.09.17.12.26.09a58.7 58.7 0 0 0 17.71-8.95.23.23 0 0 0 .09-.16c1.48-15.32-2.48-28.64-10.5-40.45a.18.18 0 0 0-.09-.09ZM23.7 37.3c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.82 7.15-6.37 7.15Zm23.58 0c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.79 7.15-6.37 7.15Z" />
              </svg>
              <span className="font-label text-sm font-bold uppercase tracking-wider text-white">Join with Discord</span>
            </button>

            {/* Benefits */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Icon name="check_circle" size={16} className="text-tertiary flex-shrink-0" />
                <span className="text-sm text-on-surface/60">One-click signup, no passwords needed</span>
              </div>
              <div className="flex items-center gap-3">
                <Icon name="check_circle" size={16} className="text-tertiary flex-shrink-0" />
                <span className="text-sm text-on-surface/60">Compete in weekly clashes for free</span>
              </div>
              <div className="flex items-center gap-3">
                <Icon name="check_circle" size={16} className="text-tertiary flex-shrink-0" />
                <span className="text-sm text-on-surface/60">Track your stats, climb the leaderboard</span>
              </div>
            </div>
          </Panel>

          {/* Footer */}
          <div className="text-center">
            <p className="text-xs font-label uppercase tracking-widest text-on-surface/40">
              Already in the arena?{' '}
              <button
                type="button"
                onClick={function () { setAuthScreen('login') }}
                className="text-primary font-bold hover:underline ml-1 bg-transparent border-0 cursor-pointer font-label text-xs tracking-widest uppercase"
              >
                Sign In
              </button>
            </p>
          </div>

        </div>
      </div>
    </PageLayout>
  )
}
