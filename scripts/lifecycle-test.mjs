import assert from 'node:assert/strict'
import { GameManager } from '../dist-server/server/game/GameManager.js'

const games = new GameManager(() => 0.1)
const first = games.create('socket-a', 'Ana', 'es')
const second = games.join('socket-b', 'Biel', first.room.code)
first.room.setWord(first.playerId, 'CASA')
first.room.guess(second.playerId, 'C')
const before = first.room.viewFor(second.playerId)

const disconnected = games.markReconnecting('socket-b')
assert.ok(disconnected)
assert.equal(games.rooms.has(first.room.code), true)
assert.equal(first.room.player(second.playerId)?.connectionState, 'reconnecting')
assert.throws(() => first.room.guess(second.playerId, 'A'), /opponent-reconnecting/)

games.resume('socket-c', first.room.code, second.playerId, second.reconnectToken)
const after = first.room.viewFor(second.playerId)
assert.equal(first.room.player(second.playerId)?.socketId, 'socket-c')
assert.equal(first.room.player(second.playerId)?.connectionState, 'connected')
assert.equal(games.identityForSocket('socket-b'), undefined)
assert.equal(games.identityForSocket('socket-c')?.playerId, second.playerId)
assert.deepEqual(after.displayWord, before.displayWord)
assert.deepEqual(after.guessedLetters, before.guessedLetters)
assert.equal(after.roundNumber, before.roundNumber)
assert.equal(after.privateWord, undefined)

games.markReconnecting('socket-c')
games.removePlayer(second.playerId)
assert.equal(first.room.player(second.playerId), undefined)
assert.equal(games.rooms.has(first.room.code), true)
games.removePlayer(first.playerId)
assert.equal(games.rooms.has(first.room.code), false)

console.log('Reconnect lifecycle checks passed')
