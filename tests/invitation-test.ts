import assert from 'node:assert/strict'
import { invitationUrl, normalizeInvitationCode } from '../src/multiplayer/invitations.ts'

assert.equal(normalizeInvitationCode('abc23'), 'ABC23')
assert.equal(normalizeInvitationCode(' abc23 '), 'ABC23')
assert.equal(normalizeInvitationCode('ABC1!'), '')
assert.equal(normalizeInvitationCode('ABC234'), '')
assert.equal(normalizeInvitationCode(null), '')

assert.equal(invitationUrl('https://penjat.cat', 'abc23'), 'https://penjat.cat/multijugador/?sala=ABC23')
assert.equal(invitationUrl('http://localhost:5173', 'ZZ999'), 'http://localhost:5173/multijugador/?sala=ZZ999')
assert.equal(invitationUrl('https://penjat.cat', 'bad'), 'https://penjat.cat/multijugador/')

console.log('invitation tests passed')
