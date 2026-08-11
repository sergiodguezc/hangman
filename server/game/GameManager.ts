import type { Language } from '../../shared/game.js'
import { GameRoom } from './GameRoom.js'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export class GameManager {
  readonly rooms = new Map<string, GameRoom>()
  private readonly playerRooms = new Map<string, string>()

  create(playerId: string, name: string, language: Language) {
    let code = this.code()
    while (this.rooms.has(code)) code = this.code()
    const room = new GameRoom(code, language)
    room.addPlayer(playerId, name)
    this.rooms.set(code, room)
    this.playerRooms.set(playerId, code)
    return room
  }

  join(playerId: string, name: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase()
    const room = this.rooms.get(code)
    if (!room) throw new Error('room-not-found')
    room.addPlayer(playerId, name)
    this.playerRooms.set(playerId, code)
    return room
  }

  roomFor(playerId: string) {
    const code = this.playerRooms.get(playerId)
    return code ? this.rooms.get(code) : undefined
  }

  leave(playerId: string) {
    const room = this.roomFor(playerId)
    if (!room) return undefined
    room.disconnect(playerId)
    this.playerRooms.delete(playerId)
    if (!room.players.length) this.rooms.delete(room.code)
    return room
  }

  private code() {
    return Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
  }
}
