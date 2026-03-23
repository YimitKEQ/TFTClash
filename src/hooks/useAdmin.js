import { useApp } from '../context/AppContext'

export function useAdmin() {
  var ctx = useApp()
  return {
    isAdmin: ctx.isAdmin,
    setIsAdmin: ctx.setIsAdmin,
    announcement: ctx.announcement,
    setAnnouncement: ctx.setAnnouncement,
    auditLog: ctx.auditLog,
    setAuditLog: ctx.setAuditLog,
    hostApps: ctx.hostApps,
    setHostApps: ctx.setHostApps,
  }
}
