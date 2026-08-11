import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { Server } from 'socket.io'
import { ALPHABETS, type Language } from '../shared/game.js'
import type { ClientToServerEvents, ServerToClientEvents, Ack } from '../shared/protocol.js'
import { GameManager } from './game/GameManager.js'

const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '0.0.0.0'
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const frontendDist = resolve(process.cwd(), 'dist')
const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
}

const httpServer = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost')
  if (url.pathname.startsWith('/socket.io/')) return

  response.setHeader('X-Content-Type-Options', 'nosniff')
  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify({ ok: true }))
    return
  }
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
    response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return
  }

  try {
    const requestedPath = decodeURIComponent(url.pathname)
    let filePath = resolve(frontendDist, `.${requestedPath === '/' ? '/index.html' : requestedPath}`)
    if (filePath !== frontendDist && !filePath.startsWith(`${frontendDist}${sep}`)) throw new Error('Invalid path')
    const fileStats = await stat(filePath).catch(() => null)
    if (!fileStats?.isFile()) filePath = resolve(frontendDist, 'index.html')
    const body = await readFile(filePath)
    const isAsset = filePath.includes(`${sep}assets${sep}`)
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Frontend build unavailable. Run npm run build before starting the server.')
  }
})
const localDevelopmentOrigins = [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/]
const allowedOrigins = CLIENT_ORIGIN || (IS_PRODUCTION ? undefined : localDevelopmentOrigins)
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  ...(allowedOrigins ? { cors: { origin: allowedOrigins } } : {}),
})
const games = new GameManager()

const cleanName = (value: unknown) => typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 24 ? value.trim() : null

io.on('connection', (socket) => {
  const broadcast = (code: string) => {
    const room = games.rooms.get(code)
    if (!room) return
    for (const player of room.players) io.to(player.id).emit('room:state', room.viewFor(player.id))
  }
  const action = (ack: Ack, operation: () => void) => {
    try { operation(); ack({ ok: true, data: undefined }) }
    catch (error) { ack({ ok: false, error: error instanceof Error ? error.message : 'unknown-error' }) }
  }

  socket.on('room:create', (payload, ack) => {
    const name = cleanName(payload?.name)
    const language = payload?.language as Language
    if (!name || !(language in ALPHABETS)) return ack({ ok: false, error: 'invalid-details' })
    const room = games.create(socket.id, name, language)
    socket.join(room.code)
    ack({ ok: true, data: room.viewFor(socket.id) })
    socket.emit('chat:history', room.chatHistory)
  })

  socket.on('room:join', (payload, ack) => {
    const name = cleanName(payload?.name)
    if (!name || typeof payload?.code !== 'string') return ack({ ok: false, error: 'invalid-details' })
    try {
      const room = games.join(socket.id, name, payload.code)
      socket.join(room.code)
      ack({ ok: true, data: room.viewFor(socket.id) })
      socket.emit('chat:history', room.chatHistory)
      broadcast(room.code)
    } catch (error) { ack({ ok: false, error: error instanceof Error ? error.message : 'unknown-error' }) }
  })

  socket.on('round:set-word', (payload, ack) => action(ack, () => {
    const room = games.roomFor(socket.id)
    if (!room) throw new Error('room-not-found')
    room.setWord(socket.id, payload?.word)
    broadcast(room.code)
  }))

  socket.on('game:guess', (payload, ack) => action(ack, () => {
    const room = games.roomFor(socket.id)
    if (!room) throw new Error('room-not-found')
    room.guess(socket.id, payload?.letter)
    broadcast(room.code)
  }))

  socket.on('round:forgiveness', (payload, ack) => action(ack, () => {
    const room = games.roomFor(socket.id)
    if (!room) throw new Error('room-not-found')
    room.decideForgiveness(socket.id, payload?.forgive)
    broadcast(room.code)
  }))

  socket.on('round:continue', (ack) => action(ack, () => {
    const room = games.roomFor(socket.id)
    if (!room) throw new Error('room-not-found')
    room.continue(socket.id)
    broadcast(room.code)
  }))

  socket.on('chat:send', (payload, ack) => {
    try {
      const room = games.roomFor(socket.id)
      if (!room) throw new Error('not-room-member')
      const message = room.addChatMessage(socket.id, payload?.text)
      io.to(room.code).emit('chat:message', message)
      ack({ ok: true, data: message })
    } catch (error) {
      ack({ ok: false, error: error instanceof Error ? error.message : 'invalid-chat-message' })
    }
  })

  const leave = () => {
    const room = games.leave(socket.id)
    if (room) broadcast(room.code)
  }
  socket.on('room:leave', leave)
  socket.on('disconnect', leave)
})

httpServer.listen(PORT, HOST, () => console.log(`Hangman server listening on http://${HOST}:${PORT}`))

export { httpServer, games }
