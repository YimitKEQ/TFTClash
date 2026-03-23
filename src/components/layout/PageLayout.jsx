import { useAuth } from '../../hooks/useAuth'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import Footer from './Footer'

export default function PageLayout({ children, showSidebar = true, maxWidth = 'max-w-7xl' }) {
  const { isLoggedIn } = useAuth()
  const showSide = isLoggedIn && showSidebar

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {showSide && <Sidebar />}
      <main className={`pt-20 pb-24 md:pb-12 px-4 md:px-8 ${showSide ? 'xl:ml-64' : ''}`}>
        <div className={`${maxWidth} mx-auto`}>
          {children}
        </div>
      </main>
      <Footer />
      {isLoggedIn && <MobileNav />}
    </div>
  )
}
