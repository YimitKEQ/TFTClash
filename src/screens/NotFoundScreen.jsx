import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Icon } from '../components/ui'

export default function NotFoundScreen() {
  var navigate = useNavigate()
  var ctx = useApp()
  var setScreen = ctx.setScreen

  // SPA rewrite returns HTTP 200 for unknown URLs (we can't change that without
  // server prerendering). Instead, signal "not found" to crawlers via a noindex
  // meta tag so they don't dedupe the homepage across phantom routes.
  useEffect(function() {
    var prevTitle = document.title
    document.title = '404 - Page not found - TFT Clash'

    var robots = document.querySelector('meta[name="robots"]')
    var created = false
    var prevContent = null
    if (robots) {
      prevContent = robots.getAttribute('content')
    } else {
      robots = document.createElement('meta')
      robots.setAttribute('name', 'robots')
      document.head.appendChild(robots)
      created = true
    }
    robots.setAttribute('content', 'noindex, nofollow')

    return function() {
      document.title = prevTitle
      if (created) {
        if (robots.parentNode) robots.parentNode.removeChild(robots)
      } else if (prevContent !== null) {
        robots.setAttribute('content', prevContent)
      } else {
        robots.removeAttribute('content')
      }
    }
  }, [])

  function goHome() {
    setScreen('home')
    navigate('/')
  }

  return (
    <PageLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <Icon name="search_off" size={64} className="text-primary/30 mb-6" />
        <h1 className="font-editorial text-8xl md:text-9xl text-primary/20 font-bold leading-none mb-2">
          404
        </h1>
        <h2 className="font-editorial text-2xl md:text-3xl text-on-surface mb-3">
          Page not found
        </h2>
        <p className="text-on-surface/50 text-sm max-w-sm mb-8">
          This URL does not match any page in TFT Clash. It may have moved or never existed.
        </p>
        <Btn variant="primary" size="md" icon="home" onClick={goHome}>
          Go Home
        </Btn>
      </div>
    </PageLayout>
  )
}
