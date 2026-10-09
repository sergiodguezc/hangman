import type { PlayerGameView, RoomStatus, RoundStatus } from '../../shared/protocol'

export type MultiplayerPhase = Exclude<RoomStatus, 'active'> | RoundStatus | 'waiting'

export function multiplayerPhase(state: Pick<PlayerGameView, 'roomStatus' | 'round'>): MultiplayerPhase {
  return state.roomStatus === 'active' ? state.round?.status ?? 'waiting' : state.roomStatus
}

// Reconnecting players remain eligible until the server removes them from the roster.
export function rematchAvailability(state: Pick<PlayerGameView, 'players' | 'match' | 'roomStatus'>) {
  const activeIds = new Set(state.players.filter((player) => player.active).map((player) => player.id))
  return {
    available: state.roomStatus === 'match-over' && activeIds.size >= 2,
    total: activeIds.size,
    readyIds: state.match.rematchReadyPlayerIds.filter((id) => activeIds.has(id)),
  }
}

export function hasSelectedWord(state: Pick<PlayerGameView, 'privateWord' | 'self' | 'observedPlayer'>) {
  return Boolean(state.privateWord || state.self?.displayWord.length || state.observedPlayer?.displayWord.length)
}
