import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase, CANONICAL_ORIGIN } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Icon } from '../components/ui'

export default function SignUpScreen() {
  var ctx = useApp()
  var toast = ctx.toast
  var setAuthScreen = ctx.setAuthScreen
  var currentUser = ctx.currentUser

  // If the user is already logged in (e.g. Discord OAuth returning an existing user),
  // close the signup screen immediately and show a welcome-back toast.
  useEffect(function() {
    if (currentUser) {
      toast('Welcome back, ' + (currentUser.username || 'player') + '! You are already signed in.', 'info')
      setAuthScreen(null)
    }
  }, [currentUser && currentUser.id])

  async function handleDiscordSignUp() {
    var res = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: CANONICAL_ORIGIN }
    })
    if (res.error) { toast(res.error.message, 'error') }
  }

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
            <p className="font-serif text-lg italic text-on-surface/60">Your leaderboard spot is free. Always.</p>
          </div>

          {/* Auth card */}
          <div className="bg-surface-container-low relative overflow-hidden shadow-[0_40px_40px_rgba(0,0,0,0.4)]">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

            <div className="p-10 space-y-8">
              {/* Form header */}
              <div className="space-y-1">
                <h2 className="font-serif text-3xl font-bold">Join the Arena</h2>
                <p className="text-xs font-condensed uppercase tracking-widest text-on-surface/40">Free to compete, every week</p>
              </div>

              {/* Discord signup */}
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={handleDiscordSignUp}
                  className="w-full flex items-center justify-center space-x-3 py-4 bg-[#5865F2] border-0 rounded-full hover:opacity-85 hover:scale-[1.02] active:scale-95 transition-all duration-300 cursor-pointer shadow-lg shadow-[#5865F2]/20"
                >
                  <svg width="20" height="15" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.22.22 0 0 0-.23.11 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.83-3.7.23.23 0 0 0-.23-.11A58.3 58.3 0 0 0 10.9 4.9a.21.21 0 0 0-.1.08C1.58 18.73-.96 32.16.3 45.43a.24.24 0 0 0 .09.17 58.8 58.8 0 0 0 17.7 8.95.23.23 0 0 0 .25-.09 42 42 0 0 0 3.62-5.89.23.23 0 0 0-.12-.31 38.7 38.7 0 0 1-5.52-2.63.23.23 0 0 1-.02-.38c.37-.28.74-.57 1.1-.86a.22.22 0 0 1 .23-.03c11.58 5.29 24.12 5.29 35.56 0a.22.22 0 0 1 .23.03c.36.29.73.58 1.1.86a.23.23 0 0 1-.02.38 36.3 36.3 0 0 1-5.52 2.63.23.23 0 0 0-.13.31 47.2 47.2 0 0 0 3.62 5.89c.06.09.17.12.26.09a58.7 58.7 0 0 0 17.71-8.95.23.23 0 0 0 .09-.16c1.48-15.32-2.48-28.64-10.5-40.45a.18.18 0 0 0-.09-.09ZM23.7 37.3c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.82 7.15-6.37 7.15Zm23.58 0c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.79 7.15-6.37 7.15Z" />
                  </svg>
                  <span className="font-condensed text-sm font-bold uppercase tracking-widest text-white">Join with Discord</span>
                </button>

                {/* Benefits */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    <Icon name="check_circle" size={18} className="text-tertiary flex-shrink-0" />
                    <span className="text-sm text-on-surface/60">One-click signup, no passwords needed</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Icon name="check_circle" size={18} className="text-tertiary flex-shrink-0" />
                    <span className="text-sm text-on-surface/60">Compete in weekly clashes for free</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Icon name="check_circle" size={18} className="text-tertiary flex-shrink-0" />
                    <span className="text-sm text-on-surface/60">Track your stats, climb the leaderboard</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card footer */}
            <div className="bg-surface-container-highest/30 p-6 text-center">
              <p className="text-xs font-condensed tracking-widest uppercase text-on-surface/40">
                Already in the arena?{' '}
                <button
                  type="button"
                  onClick={function () { setAuthScreen('login') }}
                  className="text-secondary font-bold hover:underline ml-1 bg-transparent border-0 cursor-pointer font-condensed text-xs tracking-widest uppercase"
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
