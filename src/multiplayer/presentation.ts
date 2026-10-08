import type { PlayerGameView, RoomStatus, RoundStatus } from '../../shared/protocol'

export type MultiplayerPhase = Exclude<RoomStatus, 'active'> | RoundStatus | 'waiting'

export function multiplayerPhase(state: Pick<PlayerGameView, 'roomStatus' | 'round'>): MultiplayerPhase {
  return state.roomStatus === 'active' ? state.round?.status ?? 'waiting' : state.roomStatus
}
