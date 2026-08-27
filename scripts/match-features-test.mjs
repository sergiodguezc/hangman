import assert from 'node:assert/strict'
import { GameRoom } from '../dist-server/server/game/GameRoom.js'

const addPlayers = (room, count) => {
  for (let index = 1; index <= count; index += 1) room.addPlayer(`p${index}`, `s${index}`, `t${index}`, `Player ${index}`)
}

// A two-player match is the N=2 path and lasts exactly N * voltes turns.
const two = new GameRoom('TWO', 'es', 3, () => 0.9)
addPlayers(two, 2)
two.start('p1')
const setters = []
while (two.roomStatus === 'active') {
  const state = two.viewFor('p1')
  setters.push(state.round.setterId)
  const guesser = two.players.find((player) => player.active && player.id !== state.round.setterId).id
  two.setWord(state.round.setterId, 'A')
  two.guess(guesser, 'A')
  if (two.roomStatus === 'active') two.continue(guesser)
}
assert.deepEqual(setters, ['p2', 'p1', 'p2', 'p1', 'p2', 'p1'])
assert.equal(two.viewFor('p1').match.totalTurns, 6)
assert.equal(two.viewFor('p1').roomStatus, 'match-over')

// Rematch consensus is generalized to every active member.
const group = new GameRoom('GROUP', 'ca', 1, () => 0)
addPlayers(group, 3)
group.start('p1')
group.setWord('p1', 'A')
group.guess('p2', 'A')
group.guess('p3', 'A')
group.continue('p2')
group.setWord('p2', 'A')
group.guess('p1', 'A')
group.guess('p3', 'A')
group.continue('p3')
group.setWord('p3', 'A')
group.guess('p1', 'A')
group.guess('p2', 'A')
assert.equal(group.roomStatus, 'match-over')
for (const player of group.players) group.requestRematch(player.id)
assert.equal(group.roomStatus, 'active')
assert.equal(group.viewFor('p1').round.number, 1)
assert.deepEqual(group.players.map((player) => player.score), [0, 0, 0])
assert.equal(group.chatHistory.length, 0)

console.log('N-player match rotation and rematch checks passed')
