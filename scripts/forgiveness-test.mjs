import assert from 'node:assert/strict'
import { GameRoom } from '../dist-server/server/game/GameRoom.js'

const room = new GameRoom('TEST', 'es', 1, () => 0)
room.addPlayer('setter', 's1', 't1', 'Setter')
room.addPlayer('guesser', 's2', 't2', 'Guesser')
room.start('setter')
room.setWord('setter', 'A')

for (const letter of ['B', 'C', 'D', 'E', 'F']) room.guess('guesser', letter)
assert.equal(room.viewFor('guesser').round.status, 'guessing')
assert.equal(room.viewFor('guesser').self.errors, 5)

room.guess('guesser', 'G')
let view = room.viewFor('guesser')
assert.equal(view.self.status, 'awaiting-forgiveness')
assert.equal(view.self.errors, 6)
assert.equal(view.privateWord, undefined)
assert.deepEqual(view.self.wrongLetters, ['B', 'C', 'D', 'E', 'F', 'G'])
assert.deepEqual(view.forgivenessRequests, [])
assert.throws(() => room.guess('guesser', 'H'), /not-guesser/)
const setterRequest = room.viewFor('setter').forgivenessRequests[0]
assert.ok(setterRequest)
assert.throws(() => room.decideForgiveness('guesser', setterRequest.id, true), /cannot-decide-forgiveness/)

const requestId = setterRequest.id
room.decideForgiveness('setter', requestId, true)
view = room.viewFor('guesser')
assert.equal(view.self.status, 'playing')
assert.equal(view.self.errors, 6)
assert.equal(view.self.forgiven, true)
assert.ok(view.self.guessedLetters.includes('G'))
assert.throws(() => room.decideForgiveness('setter', requestId, true), /cannot-decide-forgiveness/)

room.guess('guesser', 'H')
assert.equal(room.viewFor('guesser').self.status, 'eliminated')
assert.equal(room.viewFor('guesser').self.errors, 7)
assert.equal(room.viewFor('guesser').round.status, 'round-over')
assert.equal(room.viewFor('guesser').players.find((player) => player.id === 'setter').score, 0)
assert.equal(room.viewFor('guesser').privateWord, 'A')

console.log('Forgiveness room-state checks passed')
