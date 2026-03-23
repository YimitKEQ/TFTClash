import { useApp } from '../context/AppContext'

export function usePlayers() {
  var ctx = useApp()
  return {
    players: ctx.players,
    setPlayers: ctx.setPlayers,
    getPlayerByName: function(name) { return ctx.players.find(function(p) { return p.name === name; }); },
    getPlayerById: function(id) { return ctx.players.find(function(p) { return p.id === id; }); },
  }
}
