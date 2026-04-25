import { useApp } from '../context/AppContext'

export function useAuth() {
  var ctx = useApp()
  return {
    currentUser: ctx.currentUser,
    setCurrentUser: ctx.setCurrentUser,
    isAdmin: ctx.isAdmin,
    isAuthLoading: ctx.isAuthLoading,
    isLoggedIn: !!ctx.currentUser,
  }
}
