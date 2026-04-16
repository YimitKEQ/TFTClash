import { useApp } from '../context/AppContext'
import { supabase, CANONICAL_ORIGIN } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Icon } from '../components/ui'

export default function LoginScreen() {
  var ctx = useApp()
  var toast = ctx.toast
  var setCurrentUser = ctx.setCurrentUser
  var setAuthScreen = ctx.setAuthScreen

  async function handleDiscordLogin() {
    var res = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: CANONICAL_ORIGIN }
    })
    if (res.error) { toast(res.error.message, 'error') }
  }

  function handleGuestLogin() {
    setCurrentUser(null)
    setAuthScreen(null)
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
            <p className="font-editorial text-base text-on-surface/50 italic">Welcome back, Challenger</p>
          </div>

          {/* Auth panel */}
          <Panel className="p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="font-headline text-xl font-bold text-on-surface">Sign In</h2>
              <p className="text-xs font-label uppercase tracking-widest text-on-surface/40">Continue with your Discord account</p>
            </div>

            {/* Discord button */}
            <button
              type="button"
              onClick={handleDiscordLogin}
              className="w-full flex items-center justify-center gap-3 py-3.5 bg-discord-blurple border-0 rounded-lg hover:bg-discord-blurple-hover active:scale-[0.98] transition-all motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-discord-blurple focus-visible:ring-offset-2 focus-visible:ring-offset-surface cursor-pointer"
            >
              <svg width="20" height="15" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M60.1 4.9A58.5 58.5 0 0 0 45.6.9a.22.22 0 0 0-.23.11 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.3 37.3 0 0 0-1.83-3.7.23.23 0 0 0-.23-.11A58.3 58.3 0 0 0 10.9 4.9a.21.21 0 0 0-.1.08C1.58 18.73-.96 32.16.3 45.43a.24.24 0 0 0 .09.17 58.8 58.8 0 0 0 17.7 8.95.23.23 0 0 0 .25-.09 42 42 0 0 0 3.62-5.89.23.23 0 0 0-.12-.31 38.7 38.7 0 0 1-5.52-2.63.23.23 0 0 1-.02-.38c.37-.28.74-.57 1.1-.86a.22.22 0 0 1 .23-.03c11.58 5.29 24.12 5.29 35.56 0a.22.22 0 0 1 .23.03c.36.29.73.58 1.1.86a.23.23 0 0 1-.02.38 36.3 36.3 0 0 1-5.52 2.63.23.23 0 0 0-.13.31 47.2 47.2 0 0 0 3.62 5.89c.06.09.17.12.26.09a58.7 58.7 0 0 0 17.71-8.95.23.23 0 0 0 .09-.16c1.48-15.32-2.48-28.64-10.5-40.45a.18.18 0 0 0-.09-.09ZM23.7 37.3c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.82 7.15-6.37 7.15Zm23.58 0c-3.49 0-6.37-3.21-6.37-7.15s2.82-7.15 6.37-7.15c3.58 0 6.43 3.24 6.37 7.15 0 3.94-2.79 7.15-6.37 7.15Z" />
              </svg>
              <span className="font-label text-sm font-bold uppercase tracking-wider text-white">Sign in with Discord</span>
            </button>

            <p className="text-center text-xs text-on-surface/30 leading-relaxed">
              No passwords needed. Discord handles authentication securely.
            </p>
          </Panel>

          {/* Footer links */}
          <div className="text-center space-y-3">
            <p className="text-xs font-label uppercase tracking-widest text-on-surface/40">
              New to TFT Clash?{' '}
              <button
                type="button"
                onClick={function () { setAuthScreen('signup') }}
                className="text-primary font-bold hover:underline ml-1 bg-transparent border-0 cursor-pointer font-label text-xs tracking-widest uppercase"
              >
                Join Now
              </button>
            </p>
            <p className="text-xs font-label uppercase tracking-widest text-on-surface/30">
              <button
                type="button"
                onClick={handleGuestLogin}
                className="text-on-surface/40 hover:text-on-surface/60 bg-transparent border-0 cursor-pointer font-label text-xs tracking-widest uppercase underline"
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
