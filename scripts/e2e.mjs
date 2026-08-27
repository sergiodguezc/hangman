import assert from 'node:assert/strict'
import { io } from 'socket.io-client'
import { normalizeGuess, validateSecretWord } from '../dist-server/shared/game.js'

const url = process.env.TEST_SERVER_URL || 'http://localhost:3001'
const connect = () => new Promise((resolve, reject) => {
  const socket = io(url, { transports: ['websocket'], forceNew: true })
  socket.once('connect', () => resolve(socket))
  socket.once('connect_error', reject)
})
const emit = (socket, event, payload) => new Promise((resolve) => {
  if (payload === undefined) socket.emit(event, resolve)
  else socket.emit(event, payload, resolve)
})
const stateAfter = (socket, action) => new Promise((resolve) => { socket.once('room:state', resolve); action() })
const stateMatching = (socket, predicate, action) => new Promise((resolve) => {
  const listener = (state) => {
    if (!predicate(state)) return
    socket.off('room:state', listener)
    resolve(state)
  }
  socket.on('room:state', listener)
  action()
})
const preview = async (code) => {
  const response = await fetch(`${url}/api/rooms/${code}/preview`)
  return { status: response.status, body: await response.json() }
}

const [p1, p2, p3, p4] = await Promise.all([connect(), connect(), connect(), connect()])
try {
  const created = await emit(p1, 'room:create', { name: 'Sergio', gameLanguage: 'ca', voltes: 1 })
  assert.equal(created.ok, true)
  const code = created.data.view.code
  assert.deepEqual(await preview(code), { status: 200, body: { ok: true, data: { code, gameLanguage: 'ca', voltes: 1, players: 1, acceptingPlayers: true } } })

  const p1Joined = new Promise((resolve) => p1.once('room:state', resolve))
  const joined2 = await emit(p2, 'room:join', { name: 'Marta', code })
  assert.equal(joined2.ok, true)
  await p1Joined
  const joined3 = await emit(p3, 'room:join', { name: 'Pau', code })
  assert.equal(joined3.ok, true)
  const p1Id = created.data.session.playerId
  const p2Id = joined2.data.session.playerId
  const p3Id = joined3.data.session.playerId
  assert.equal((await preview(code)).body.data.players, 3)

  const startedStates = [p1, p2, p3].map((socket) => stateAfter(socket, () => {}))
  const started = await emit(p1, 'room:start')
  assert.equal(started.ok, true)
  const states = await Promise.all(startedStates)
  assert.ok(states.every((state) => state.roomStatus === 'active'))
  assert.equal(states[0].match.totalTurns, 3)
  assert.deepEqual(await emit(p4, 'room:join', { name: 'Late', code }), { ok: false, error: 'match-started' })

  const current = states[0]
  const socketById = new Map([[p1Id, p1], [p2Id, p2], [p3Id, p3]])
  const setterId = current.round.setterId
  const setter = socketById.get(setterId)
  const guessers = [p1Id, p2Id, p3Id].filter((id) => id !== setterId)
  const startedGuessing = [p1, p2, p3].map((socket) => stateAfter(socket, () => {}))
  assert.equal((await emit(setter, 'round:set-word', { word: 'A' })).ok, true)
  const guessingStates = await Promise.all(startedGuessing)
  assert.ok(guessingStates.every((state) => state.round.status === 'guessing'))
  for (const state of guessingStates) {
    if (state.self) {
      assert.equal(state.self.playerId, state.players.find((player) => player.id === state.self.playerId).id)
      assert.equal(state.observedPlayer, undefined)
      assert.deepEqual(state.forgivenessRequests, [])
    } else {
      assert.ok(guessers.includes(state.observedPlayer.playerId))
    }
  }

  const fastGuesser = socketById.get(guessers[0])
  const slowGuesser = socketById.get(guessers[1])
  const solvedStatePromise = stateMatching(fastGuesser, (state) => state.self?.status === 'solved', () => {})
  assert.equal((await emit(fastGuesser, 'game:guess', { letter: 'A' })).ok, true)
  assert.equal((await solvedStatePromise).self.status, 'solved')
  for (const letter of ['B', 'C', 'D', 'E', 'F']) await emit(slowGuesser, 'game:guess', { letter })
  const privatePending = stateMatching(slowGuesser, (state) => state.self?.status === 'awaiting-forgiveness', () => {})
  const pending = await stateMatching(setter, (state) => state.forgivenessRequests.some((request) => request.status === 'pending'), () => slowGuesser.emit('game:guess', { letter: 'G' }, () => {}))
  assert.deepEqual((await privatePending).forgivenessRequests, [])
  assert.equal(pending.self, null)
  assert.equal(pending.forgivenessRequests.filter((request) => request.status === 'pending').length, 1)
  const request = pending.forgivenessRequests.find((item) => item.status === 'pending')
  const observed = await stateMatching(setter, (state) => state.observedPlayerId === guessers[1], () => setter.emit('round:observe-player', { playerId: guessers[1] }, () => {}))
  assert.equal(observed.observedPlayer.playerId, guessers[1])
  assert.equal(observed.observedPlayer.errors, 6)
  assert.equal((await emit(setter, 'round:forgiveness', { requestId: request.id, forgive: true })).ok, true)
  const forgiven = await stateMatching(setter, (state) => state.observedPlayer?.status === 'eliminated', () => slowGuesser.emit('game:guess', { letter: 'H' }, () => {}))
  assert.equal(forgiven.observedPlayer.status, 'eliminated')
  assert.equal(forgiven.observedPlayer.errors, 7)
  assert.deepEqual(forgiven.round.results.map(({ playerId, pointsAwarded }) => [playerId, pointsAwarded]), [[guessers[0], 2], [guessers[1], 0], [setterId, 0]])

  let afterRound = forgiven
  for (let turn = 1; turn < 3; turn += 1) {
    const nextRoundNumber = afterRound.round.number + 1
    const state = await stateMatching(p1, (candidate) => candidate.round?.number === nextRoundNumber, () => socketById.get(afterRound.round.nextSetterId).emit('round:continue', () => {}))
    const activeSetter = socketById.get(state.round.setterId)
    const activeGuessers = [p1Id, p2Id, p3Id].filter((id) => id !== state.round.setterId).map((id) => socketById.get(id))
    await emit(activeSetter, 'round:set-word', { word: 'A' })
    for (const guesser of activeGuessers.slice(0, -1)) await emit(guesser, 'game:guess', { letter: 'A' })
    afterRound = await stateMatching(p1, (candidate) => candidate.round?.status === 'round-over' || candidate.roomStatus === 'match-over', () => activeGuessers.at(-1).emit('game:guess', { letter: 'A' }, () => {}))
  }
  assert.equal(afterRound.roomStatus, 'match-over')
  assert.equal(afterRound.matchResult !== null, true)

  for (const socket of [p1, p2, p3].slice(0, 2)) await emit(socket, 'match:rematch')
  const rematched = await stateMatching(p1, (state) => state.roomStatus === 'active' && state.round?.number === 1 && state.players.every((player) => player.score === 0), () => p3.emit('match:rematch', () => {}))
  assert.equal(rematched.roomStatus, 'active')
  assert.equal(rematched.round.number, 1)
  assert.deepEqual(rematched.players.map((player) => player.score), [0, 0, 0])
  assert.equal(normalizeGuess('ç', 'ca'), 'Ç')
  assert.equal(validateSecretWord('COL·LEGI', 'ca'), 'COL·LEGI')
  console.log('E2E N-player multiplayer checks passed')
} finally {
  p1.disconnect(); p2.disconnect(); p3.disconnect(); p4.disconnect()
}
