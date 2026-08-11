import assert from 'node:assert/strict'
import { GameRoom } from '../dist-server/server/game/GameRoom.js'

const room = new GameRoom('CHAT', 'es')
room.addPlayer('p1', 'Sergio')

const first = room.addChatMessage('p1', '  Hola <img src=x onerror=alert(1)>  ')
assert.equal(first.senderId, 'p1')
assert.equal(first.senderName, 'Sergio')
assert.equal(first.text, 'Hola <img src=x onerror=alert(1)>')
assert.equal(typeof first.timestamp, 'number')
assert.throws(() => room.addChatMessage('outsider', 'Hola'), /not-room-member/)
assert.throws(() => room.addChatMessage('p1', '   '), /empty-chat-message/)
assert.throws(() => room.addChatMessage('p1', 'x'.repeat(301)), /chat-message-too-long/)

for (let index = 0; index < 55; index += 1) room.addChatMessage('p1', `Mensaje ${index}`)
assert.equal(room.chatHistory.length, 50)
assert.equal(room.chatHistory[0].text, 'Mensaje 5')
assert.equal(room.chatHistory.at(-1)?.text, 'Mensaje 54')

room.addPlayer('p2', 'Marta')
room.setWord('p1', 'CASA')
room.guess('p2', 'C')
assert.equal(room.chatHistory.length, 50)
room.addChatMessage('p2', 'Sigue aquí')
assert.equal(room.chatHistory.at(-1)?.senderName, 'Marta')

console.log('Chat validation and bounded-history checks passed')
