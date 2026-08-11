import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/protocol'

const configuredUrl = import.meta.env.VITE_SERVER_URL as string | undefined
const serverUrl = configuredUrl || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '/')

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
  autoConnect: false,
  timeout: 5_000,
})
