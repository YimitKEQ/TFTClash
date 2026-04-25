import { useApp } from '../context/AppContext'

export function useAdmin() {
  var ctx = useApp()
  return {
    isAdmin: ctx.isAdmin,
    announcement: ctx.announcement,
    setAnnouncement: ctx.setAnnouncement,
    auditLog: ctx.auditLog,
    setAuditLog: ctx.setAuditLog,
    hostApps: ctx.hostApps,
    setHostApps: ctx.setHostApps,
  }
}
