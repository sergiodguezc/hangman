import assert from 'node:assert/strict'
import { io } from 'socket.io-client'
import { normalizeGuess, validateSecretWord } from '../dist-server/shared/game.js'

const url = process.env.TEST_SERVER_URL || 'http://localhost:3001'
const connect = () => new Promise((resolve, reject) => {
  const socket = io(url, { transports: ['websocket'], forceNew: true })
  socket.once('connect', () => resolve(socket))
  socket.once('connect_error', reject)
})
const emit = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve))
const stateAfter = (socket, action) => new Promise((resolve) => { socket.once('room:state', resolve); action() })

const p1 = await connect()
const p2 = await connect()
const p3 = await connect()
try {
  const created = await emit(p1, 'room:create', { name: 'Sergio', language: 'ca' })
  assert.equal(created.ok, true)
  const code = created.data.code
  const waitingMessage = await emit(p1, 'chat:send', { text: '  Missatge abans d’entrar  ' })
  assert.equal(waitingMessage.ok, true)
  assert.equal(waitingMessage.data.senderName, 'Sergio')
  assert.equal(waitingMessage.data.text, 'Missatge abans d’entrar')
  const joinedState = new Promise((resolve) => p1.once('room:state', resolve))
  const joinedHistory = new Promise((resolve) => p2.once('chat:history', resolve))
  const p2Join = await emit(p2, 'room:join', { name: 'Marta', code })
  const roomState = await joinedState
  const history = await joinedHistory
  assert.equal(roomState.phase, 'choosing-word')
  assert.equal(roomState.wordSetterId, p1.id)
  assert.equal(p2Join.ok, true)
  assert.equal(history.length, 1)
  assert.equal(history[0].text, 'Missatge abans d’entrar')

  const p1Receives = new Promise((resolve) => p1.once('chat:message', resolve))
  const p2Receives = new Promise((resolve) => p2.once('chat:message', resolve))
  const sent = await emit(p1, 'chat:send', { text: 'Hola Marta 😄' })
  assert.equal(sent.ok, true)
  assert.equal((await p1Receives).text, 'Hola Marta 😄')
  assert.equal((await p2Receives).senderName, 'Sergio')
  const reply = new Promise((resolve) => p1.once('chat:message', resolve))
  await emit(p2, 'chat:send', { text: 'Ja ho veurem…' })
  assert.equal((await reply).senderName, 'Marta')

  assert.deepEqual(await emit(p1, 'chat:send', { text: '   ' }), { ok: false, error: 'empty-chat-message' })
  assert.deepEqual(await emit(p1, 'chat:send', { text: 'x'.repeat(301) }), { ok: false, error: 'chat-message-too-long' })

  const full = await emit(p3, 'room:join', { name: 'Third', code })
  assert.deepEqual(full, { ok: false, error: 'room-full' })
  const otherRoom = await emit(p3, 'room:create', { name: 'Other', language: 'es' })
  assert.equal(otherRoom.ok, true)
  const foreignMessages = []
  p3.on('chat:message', (message) => foreignMessages.push(message))
  await emit(p1, 'chat:send', { text: 'Solo sala uno' })
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(foreignMessages.length, 0)
  const forbidden = await emit(p2, 'round:set-word', { word: 'CANÇÓ' })
  assert.deepEqual(forbidden, { ok: false, error: 'not-word-setter' })

  const p2Started = stateAfter(p2, () => p1.emit('round:set-word', { word: 'CANÇÓ' }, () => {}))
  const guesserView = await p2Started
  assert.equal(guesserView.privateWord, undefined)
  assert.deepEqual(guesserView.displayWord, ['_', '_', '_', '_', '_'])

  for (const letter of ['C', 'A', 'N', 'O']) await new Promise((resolve) => p2.emit('game:guess', { letter }, resolve))
  const finalView = await new Promise((resolve) => { p2.emit('game:guess', { letter: 'Ç' }, () => {}); p2.once('room:state', resolve) })
  assert.equal(finalView.phase, 'round-over')
  assert.equal(finalView.privateWord, 'CANÇÓ')
  assert.equal(finalView.players.find((p) => p.id === p2.id).score, 1)

  const next = await new Promise((resolve) => { p2.once('room:state', resolve); p2.emit('round:continue', () => {}) })
  assert.equal(next.roundNumber, 2)
  assert.equal(next.wordSetterId, p2.id)
  assert.equal(next.guesserId, p1.id)
  assert.equal(next.players.find((p) => p.id === p2.id).score, 1)

  await emit(p2, 'round:set-word', { word: 'A' })
  for (const letter of ['B', 'C', 'D', 'E', 'F']) await emit(p1, 'game:guess', { letter })
  const pending = await stateAfter(p1, () => p1.emit('game:guess', { letter: 'G' }, () => {}))
  assert.equal(pending.phase, 'forgiveness-pending')
  assert.equal(pending.errors, 6)
  assert.equal(pending.privateWord, undefined)
  const unauthorizedPardon = await emit(p1, 'round:forgiveness', { forgive: true })
  assert.deepEqual(unauthorizedPardon, { ok: false, error: 'cannot-decide-forgiveness' })

  const forgiven = await stateAfter(p1, () => p2.emit('round:forgiveness', { forgive: true }, () => {}))
  assert.equal(forgiven.phase, 'guessing')
  assert.equal(forgiven.errors, 5)
  assert.ok(forgiven.wrongLetters.includes('G'))
  assert.equal(forgiven.players.find((p) => p.id === p2.id).score, 1)

  const pendingAgain = await stateAfter(p1, () => p1.emit('game:guess', { letter: 'H' }, () => {}))
  assert.equal(pendingAgain.phase, 'forgiveness-pending')
  const refused = await stateAfter(p1, () => p2.emit('round:forgiveness', { forgive: false }, () => {}))
  assert.equal(refused.phase, 'round-over')
  assert.equal(refused.players.find((p) => p.id === p2.id).score, 2)
  assert.equal(refused.privateWord, 'A')

  assert.equal(normalizeGuess('á', 'es'), 'A')
  assert.equal(normalizeGuess('ñ', 'es'), 'Ñ')
  assert.equal(normalizeGuess('ç', 'ca'), 'Ç')
  assert.equal(validateSecretWord('COL·LEGI', 'ca'), 'COL·LEGI')
  console.log('E2E multiplayer checks passed')
} finally {
  p1.disconnect(); p2.disconnect(); p3.disconnect()
}
