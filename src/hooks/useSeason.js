import { useApp } from '../context/AppContext'

export function useSeason() {
  var ctx = useApp()
  return {
    seasonConfig: ctx.seasonConfig,
    setSeasonConfig: ctx.setSeasonConfig,
  }
}
