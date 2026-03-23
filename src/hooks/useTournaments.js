import { useApp } from '../context/AppContext'

export function useTournaments() {
  var ctx = useApp()
  return {
    tournamentState: ctx.tournamentState,
    setTournamentState: ctx.setTournamentState,
    quickClashes: ctx.quickClashes,
    setQuickClashes: ctx.setQuickClashes,
    hostTournaments: ctx.hostTournaments,
    setHostTournaments: ctx.setHostTournaments,
    featuredEvents: ctx.featuredEvents,
    setFeaturedEvents: ctx.setFeaturedEvents,
    scheduledEvents: ctx.scheduledEvents,
    setScheduledEvents: ctx.setScheduledEvents,
  }
}
