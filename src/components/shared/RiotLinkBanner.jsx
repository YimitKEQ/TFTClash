import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { Icon, Btn } from '../ui'

var HIDDEN_ROUTES = ['/login', '/signup', '/account', '/auth', '/oauth', '/callback']

export default function RiotLinkBanner() {
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var navigate = useNavigate()
  var location = useLocation()

  if (!currentUser) return null

  var pathname = location && location.pathname ? location.pathname : '/'
  if (HIDDEN_ROUTES.indexOf(pathname) !== -1) return null

  var hasRiot = !!(currentUser.riot_id_eu || currentUser.riot_id_na)
  if (hasRiot) return null

  function onLink() {
    navigate('/account#riot')
  }

  return (
    <div
      role="alert"
      className="w-full bg-warning/10 border-b border-warning/30 px-4 md:px-8 py-3"
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
          <Icon name="warning" size={20} className="text-warning flex-shrink-0 mt-0.5 md:mt-0" />
          <div className="min-w-0">
            <div className="font-label text-[11px] font-bold uppercase tracking-widest text-warning">
              Riot ID Required
            </div>
            <div className="font-body text-sm text-on-surface leading-snug">
              Link your Riot ID so we can find you for the next clash.
            </div>
          </div>
        </div>
        <Btn
          variant="primary"
          size="sm"
          onClick={onLink}
          className="self-start md:self-auto"
        >
          Link Now
        </Btn>
      </div>
    </div>
  )
}
