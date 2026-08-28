import assert from 'node:assert/strict'
import { GameRoom } from '../dist-server/server/game/GameRoom.js'

const addPlayers = (room, count) => {
  for (let index = 1; index <= count; index += 1) room.addPlayer(`p${index}`, `s${index}`, `t${index}`, `Player ${index}`)
}
const solve = (room, playerId) => {
  for (const letter of ['C', 'A', 'S']) room.guess(playerId, letter)
}
const miss = (room, playerId, letters = ['B', 'D', 'E', 'F', 'G', 'H']) => {
  for (const letter of letters) room.guess(playerId, letter)
}

// Five simultaneous guessers: three solve and receive 5, 4, 3 points.
const ranking = new GameRoom('RANK', 'es', 1, () => 0)
addPlayers(ranking, 6)
ranking.start('p1')
assert.equal(ranking.totalTurns, 6)
assert.equal(ranking.viewFor('p1').round.setterId, 'p1')
ranking.setWord('p1', 'CASA')
ranking.guess('p3', 'B')
solve(ranking, 'p2')
solve(ranking, 'p3')
ranking.guess('p4', 'B'); ranking.guess('p4', 'D'); solve(ranking, 'p4')
miss(ranking, 'p5')
miss(ranking, 'p6')
let setterView = ranking.viewFor('p1')
const requests = setterView.forgivenessRequests.filter((request) => request.status === 'pending')
assert.equal(requests.length, 2)
ranking.decideForgiveness('p1', requests[0].id, true)
ranking.decideForgiveness('p1', requests[1].id, false)
ranking.guess('p5', 'I')
setterView = ranking.viewFor('p1')
assert.deepEqual(setterView.round.ranking, ['p2', 'p3', 'p4', 'p6', 'p5'])
assert.deepEqual(setterView.players.slice(1).map((player) => player.score), [5, 4, 3, 0, 0])
assert.equal(setterView.roomStatus, 'active')
assert.equal(setterView.players.find((player) => player.id === 'p5').roundStatus, 'eliminated')
assert.equal(setterView.round.results.find((result) => result.playerId === 'p5').forgiven, true)

// Guesser privacy and setter-only observation are enforced on serialized views.
const guesserView = ranking.viewFor('p2')
assert.equal(guesserView.observedPlayer, undefined)
assert.equal(guesserView.self.playerId, 'p2')
assert.deepEqual(guesserView.forgivenessRequests, [])
assert.equal(Object.prototype.hasOwnProperty.call(guesserView, 'privateWord'), true)
ranking.observePlayer('p1', 'p2')
assert.equal(ranking.viewFor('p1').observedPlayer.playerId, 'p2')
const p2Errors = ranking.viewFor('p1').observedPlayer.errors
ranking.observePlayer('p1', 'p3')
assert.equal(ranking.viewFor('p1').observedPlayer.playerId, 'p3')
ranking.observePlayer('p1', 'p2')
assert.equal(ranking.viewFor('p1').observedPlayer.errors, p2Errors)
assert.throws(() => ranking.observePlayer('p2', 'p3'), /not-word-setter/)

// Exact three-player score attribution: the setter never earns points.
const oneSolver = new GameRoom('ONE-SOLVER', 'es', 1, () => 0)
addPlayers(oneSolver, 3)
oneSolver.start('p1')
oneSolver.setWord('p1', 'A')
oneSolver.guess('p2', 'A')
miss(oneSolver, 'p3')
const failedRequest = oneSolver.viewFor('p1').forgivenessRequests.find((request) => request.playerId === 'p3')
oneSolver.decideForgiveness('p1', failedRequest.id, false)
let exactView = oneSolver.viewFor('p1')
assert.deepEqual(Object.fromEntries(exactView.players.map((player) => [player.id, player.score])), { p1: 0, p2: 2, p3: 0 })
assert.deepEqual(exactView.round.results.map(({ playerId, pointsAwarded }) => [playerId, pointsAwarded]), [['p2', 2], ['p3', 0], ['p1', 0]])
oneSolver.continue('p2')
exactView = oneSolver.viewFor('p1')
assert.equal(exactView.round.setterId, 'p2')
assert.deepEqual(Object.fromEntries(exactView.players.map((player) => [player.id, player.score])), { p1: 0, p2: 2, p3: 0 })

const twoSolvers = new GameRoom('TWO-SOLVERS', 'es', 1, () => 0)
addPlayers(twoSolvers, 3)
twoSolvers.start('p1')
twoSolvers.setWord('p1', 'A')
twoSolvers.guess('p2', 'A')
twoSolvers.guess('p3', 'A')
exactView = twoSolvers.viewFor('p1')
assert.deepEqual(Object.fromEntries(exactView.players.map((player) => [player.id, player.score])), { p1: 0, p2: 2, p3: 1 })
assert.deepEqual(exactView.round.results.map(({ playerId, pointsAwarded }) => [playerId, pointsAwarded]), [['p2', 2], ['p3', 1], ['p1', 0]])

// The same engine gives N=2 exactly two setter turns per volta.
const twoPlayers = new GameRoom('TWO', 'ca', 3, () => 0)
addPlayers(twoPlayers, 2)
const setters = []
twoPlayers.start('p1')
for (let turn = 0; turn < 6; turn += 1) {
  const view = twoPlayers.viewFor('p1')
  setters.push(view.round.setterId)
  const setterId = view.round.setterId
  const guesserId = twoPlayers.players.find((player) => player.active && player.id !== setterId).id
  twoPlayers.setWord(setterId, 'A')
  twoPlayers.guess(guesserId, 'A')
  if (twoPlayers.roomStatus === 'active') twoPlayers.continue(guesserId)
}
assert.deepEqual(setters, ['p1', 'p2', 'p1', 'p2', 'p1', 'p2'])
assert.equal(twoPlayers.viewFor('p1').roomStatus, 'match-over')

// A reconnecting guesser is frozen individually while another guesser continues.
const reconnect = new GameRoom('RECONNECT', 'es', 1, () => 0)
addPlayers(reconnect, 3)
reconnect.start('p1')
reconnect.setWord('p1', 'A')
reconnect.markReconnecting('p2', 's2')
reconnect.guess('p3', 'A')
assert.equal(reconnect.viewFor('p3').self.status, 'solved')
assert.equal(reconnect.viewFor('p2').self.status, 'playing')
reconnect.resume('p2', 't2', 's2-next')
reconnect.guess('p2', 'A')
assert.equal(reconnect.viewFor('p1').roomStatus, 'active')

// A permanent departure skips future setter slots and transfers host ownership.
const leaving = new GameRoom('LEAVE', 'es', 1, () => 0)
addPlayers(leaving, 3)
leaving.disconnect('p1')
assert.equal(leaving.hostId, 'p2')
leaving.start('p2')
leaving.setWord('p2', 'A')
leaving.disconnect('p3')
assert.equal(leaving.viewFor('p2').roomStatus, 'match-over')
assert.equal(leaving.players.find((player) => player.id === 'p2').score, 0)

console.log('N-player architecture checks passed')
