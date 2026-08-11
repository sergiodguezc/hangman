import assert from 'node:assert/strict'
import { GameRoom } from '../dist-server/server/game/GameRoom.js'

const room = new GameRoom('TEST', 'es')
room.addPlayer('setter', 'Setter')
room.addPlayer('guesser', 'Guesser')
room.setWord('setter', 'A')

for (const letter of ['B', 'C', 'D', 'E', 'F']) room.guess('guesser', letter)
assert.equal(room.viewFor('guesser').phase, 'guessing')
assert.equal(room.viewFor('guesser').errors, 5)

room.guess('guesser', 'G')
let view = room.viewFor('guesser')
assert.equal(view.phase, 'forgiveness-pending')
assert.equal(view.errors, 6)
assert.equal(view.privateWord, undefined)
assert.deepEqual(view.wrongLetters, ['B', 'C', 'D', 'E', 'F', 'G'])
assert.throws(() => room.guess('guesser', 'H'), /not-guesser/)
assert.throws(() => room.decideForgiveness('guesser', true), /cannot-decide-forgiveness/)

room.decideForgiveness('setter', true)
view = room.viewFor('guesser')
assert.equal(view.phase, 'guessing')
assert.equal(view.errors, 5)
assert.ok(view.guessedLetters.includes('G'))
assert.equal(view.players.every((player) => player.score === 0), true)

room.guess('guesser', 'G')
assert.equal(room.viewFor('guesser').errors, 5)
room.guess('guesser', 'H')
assert.equal(room.viewFor('guesser').phase, 'forgiveness-pending')
room.decideForgiveness('setter', true)
assert.equal(room.viewFor('guesser').errors, 5)
assert.ok(room.viewFor('guesser').wrongLetters.includes('H'))

room.guess('guesser', 'I')
room.decideForgiveness('setter', false)
view = room.viewFor('guesser')
assert.equal(view.phase, 'round-over')
assert.equal(view.players.find((player) => player.id === 'setter')?.score, 1)
assert.equal(view.privateWord, 'A')

console.log('Forgiveness room-state checks passed')
