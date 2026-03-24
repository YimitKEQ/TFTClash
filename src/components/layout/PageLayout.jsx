import Navbar from './Navbar'
import Footer from './Footer'

export default function PageLayout({ children, maxWidth }) {
  var mw = maxWidth || 'max-w-7xl'
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-24 md:pb-12 px-4 md:px-8">
        <div className={mw + ' mx-auto py-8'}>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}
