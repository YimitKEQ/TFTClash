import { useApp } from '../context/AppContext'

export function useNotifications() {
  var ctx = useApp()
  return {
    notifications: ctx.notifications,
    setNotifications: ctx.setNotifications,
    toasts: ctx.toasts,
    toast: ctx.toast,
    removeToast: ctx.removeToast,
    markAllRead: ctx.markAllRead,
  }
}
