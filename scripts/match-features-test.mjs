import assert from 'node:assert/strict'
import { GameRoom } from '../dist-server/server/game/GameRoom.js'

const addPlayers = (room) => {
  room.addPlayer('p1', 's1', 't1', 'Sergio')
  room.addPlayer('p2', 's2', 't2', 'Marta')
}

const completeRoundForGuesser = (room) => {
  room.setWord(room.wordSetterId, 'A')
  room.guess(room.guesserId, 'A')
}

const reachTargetInFirstRoundOfPair = (room, target = 3) => {
  room.player(room.guesserId).score = target - 1
  completeRoundForGuesser(room)
  assert.equal(room.roundNumber % 2, 1)
  assert.equal(room.phase, 'round-over')
  assert.equal(room.matchWinnerId, null)
  assert.equal(room.matchResult, null)
  assert.equal(room.viewFor('p1').matchEndingPending, true)
}

// Controlled randomness can select either initial setter, and roles still alternate.
for (const random of [() => 0.1, () => 0.9]) {
  const roles = new GameRoom('ROLES', 'es', 5, random)
  addPlayers(roles)
  const firstSetter = roles.wordSetterId
  completeRoundForGuesser(roles)
  roles.continue(roles.guesserId)
  assert.notEqual(roles.wordSetterId, firstSetter)
}

// Reaching the target halfway through a pair never ends the match immediately.
const winning = new GameRoom('WIN', 'es', 3, () => 0.1)
addPlayers(winning)
reachTargetInFirstRoundOfPair(winning)
const leaderId = winning.roundWinnerId
const reconnectingId = winning.wordSetterId
winning.markReconnecting(reconnectingId, winning.player(reconnectingId).socketId)
assert.equal(winning.viewFor(reconnectingId).matchEndingPending, true)
winning.resume(reconnectingId, winning.player(reconnectingId).reconnectToken, 'replacement-socket')
assert.equal(winning.viewFor(reconnectingId).matchEndingPending, true)
winning.continue(winning.guesserId)
completeRoundForGuesser(winning)
assert.equal(winning.phase, 'match-over')
assert.deepEqual(winning.matchResult, { kind: 'win', winnerId: leaderId })
assert.equal(winning.matchWinnerId, leaderId)

// The matching round can produce a draw, which ends without overtime or a fake winner.
const draw = new GameRoom('DRAW', 'es', 3, () => 0.1)
addPlayers(draw)
reachTargetInFirstRoundOfPair(draw)
draw.player(draw.wordSetterId).score = 2
draw.continue(draw.guesserId)
completeRoundForGuesser(draw)
assert.equal(draw.phase, 'match-over')
assert.deepEqual(draw.matchResult, { kind: 'draw' })
assert.equal(draw.matchWinnerId, null)
assert.equal(draw.roundNumber, 2)

// Final comparison uses the scores, so the other player may overtake the first threshold player.
const overtaken = new GameRoom('OVERTAKE', 'es', 3, () => 0.1)
addPlayers(overtaken)
reachTargetInFirstRoundOfPair(overtaken)
const firstThresholdPlayer = overtaken.roundWinnerId
const otherPlayer = overtaken.players.find((player) => player.id !== firstThresholdPlayer)
otherPlayer.score = 3
overtaken.continue(overtaken.guesserId)
completeRoundForGuesser(overtaken)
assert.deepEqual(overtaken.matchResult, { kind: 'win', winnerId: otherPlayer.id })

// A completed pair below the threshold continues normally.
const nonWinning = new GameRoom('MORE', 'es', 5, () => 0.1)
addPlayers(nonWinning)
nonWinning.roundNumber = 2
nonWinning.player(nonWinning.guesserId).score = 3
completeRoundForGuesser(nonWinning)
assert.equal(nonWinning.phase, 'round-over')
assert.equal(nonWinning.matchResult, null)

// Unlimited matches never automatically end.
const unlimited = new GameRoom('ENDLESS', 'es', null, () => 0.1)
addPlayers(unlimited)
unlimited.player(unlimited.guesserId).score = 999
completeRoundForGuesser(unlimited)
assert.equal(unlimited.player(unlimited.roundWinnerId).score, 1000)
assert.equal(unlimited.phase, 'round-over')

// Draw rematches preserve room settings/chat and reset match state and scores.
draw.addChatMessage('p1', '¿Otra?')
draw.requestRematch('p1')
assert.equal(draw.phase, 'match-over')
draw.requestRematch('p2')
assert.equal(draw.phase, 'choosing-word')
assert.equal(draw.roundNumber, 1)
assert.deepEqual(draw.players.map((player) => player.score), [0, 0])
assert.equal(draw.matchTarget, 3)
assert.equal(draw.language, 'es')
assert.equal(draw.chatHistory.length, 1)
assert.equal(draw.matchResult, null)
assert.equal(draw.viewFor('p1').matchEndingPending, false)

console.log('Paired-round match target, draw, randomized roles, unlimited, and rematch checks passed')
