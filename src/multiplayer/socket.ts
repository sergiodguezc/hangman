import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, RoomSession, ServerToClientEvents } from '../../shared/protocol'

const configuredUrl = import.meta.env.VITE_SERVER_URL as string | undefined
const serverUrl = configuredUrl || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '/')

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
  autoConnect: false,
  timeout: 5_000,
})

const SESSION_KEY = 'hangman-room-session'
export function loadRoomSession(): RoomSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null')
    return value?.roomCode && value?.playerId && value?.reconnectToken ? value : null
  } catch { return null }
}
export const saveRoomSession = (session: RoomSession) => sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
export const clearRoomSession = () => sessionStorage.removeItem(SESSION_KEY)
