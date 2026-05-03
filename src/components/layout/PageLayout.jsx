import Navbar from './Navbar'
import Footer from './Footer'
import TournamentStatusStrip from './TournamentStatusStrip'

export default function PageLayout({ children, maxWidth }) {
  var mw = maxWidth || 'max-w-7xl'
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="pt-20 flex-1 flex flex-col">
        <TournamentStatusStrip />
        <main className="pb-24 md:pb-12 px-4 md:px-8 flex-1">
          <div className={mw + ' mx-auto py-8'}>
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
