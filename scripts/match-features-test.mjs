import assert from 'node:assert/strict'
import { GameRoom } from '../dist-server/server/game/GameRoom.js'

const addPlayers = (room) => {
  room.addPlayer('p1', 's1', 't1', 'Sergio')
  room.addPlayer('p2', 's2', 't2', 'Marta')
}

// Controlled randomness selects player two; the following round still alternates.
const roles = new GameRoom('ROLES', 'es', 5, () => 0.9)
addPlayers(roles)
assert.equal(roles.wordSetterId, 'p2')
assert.equal(roles.guesserId, 'p1')
roles.setWord('p2', 'A')
roles.guess('p1', 'A')
roles.continue('p1')
assert.equal(roles.wordSetterId, 'p1')
assert.equal(roles.guesserId, 'p2')

const winning = new GameRoom('WIN', 'es', 3, () => 0.1)
addPlayers(winning)
winning.player('p2').score = 2
winning.setWord('p1', 'B')
winning.guess('p2', 'B')
assert.equal(winning.player('p2').score, 3)
assert.equal(winning.phase, 'match-over')
assert.equal(winning.matchWinnerId, 'p2')

const nonWinning = new GameRoom('MORE', 'es', 5, () => 0.1)
addPlayers(nonWinning)
nonWinning.player('p2').score = 2
nonWinning.setWord('p1', 'C')
nonWinning.guess('p2', 'C')
assert.equal(nonWinning.phase, 'round-over')
assert.equal(nonWinning.matchWinnerId, null)

const unlimited = new GameRoom('ENDLESS', 'es', null, () => 0.1)
addPlayers(unlimited)
unlimited.player('p2').score = 999
unlimited.setWord('p1', 'D')
unlimited.guess('p2', 'D')
assert.equal(unlimited.player('p2').score, 1000)
assert.equal(unlimited.phase, 'round-over')

winning.addChatMessage('p1', '¿Otra?')
winning.requestRematch('p1')
assert.equal(winning.phase, 'match-over')
assert.equal(winning.player('p2').score, 3)
winning.requestRematch('p2')
assert.equal(winning.phase, 'choosing-word')
assert.equal(winning.roundNumber, 1)
assert.deepEqual(winning.players.map((player) => player.score), [0, 0])
assert.equal(winning.chatHistory.length, 1)
assert.equal(winning.viewFor('p1').privateWord, undefined)
assert.deepEqual(winning.viewFor('p1').guessedLetters, [])
assert.deepEqual(winning.viewFor('p1').rematchReadyPlayerIds, [])
assert.equal(winning.wordSetterId, 'p1')
assert.equal(winning.guesserId, 'p2')

console.log('Match target, randomized roles, and rematch checks passed')
