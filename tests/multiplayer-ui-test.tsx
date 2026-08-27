import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PublicPlayer, RoundResultEntry } from '../shared/protocol'
import { ForgivenessTray } from '../src/components/ForgivenessTray'
import { PlayerRoundStatusNotice } from '../src/components/PlayerRoundStatusNotice'
import { RoundResults } from '../src/components/RoundResults'
import { multiplayerTranslations } from '../src/multiplayer/i18n'

const solvedCa = renderToStaticMarkup(<PlayerRoundStatusNotice status="solved" t={multiplayerTranslations.ca} />)
const solvedEs = renderToStaticMarkup(<PlayerRoundStatusNotice status="solved" t={multiplayerTranslations.es} />)
const eliminated = renderToStaticMarkup(<PlayerRoundStatusNotice status="eliminated" t={multiplayerTranslations.ca} />)
assert.match(solvedCa, /Has encertat la paraula!/)
assert.match(solvedCa, /role="status"/)
assert.match(solvedEs, /¡Has acertado la palabra!/)
assert.match(eliminated, /Has quedat fora/)

const players: PublicPlayer[] = [
  { id: 'A', name: 'Setter', score: 0, connectionState: 'connected', active: true, roundStatus: 'setter' },
  { id: 'B', name: 'Winner', score: 2, connectionState: 'connected', active: true, roundStatus: 'solved' },
  { id: 'D', name: 'Forgiven', score: 1, connectionState: 'connected', active: true, roundStatus: 'solved' },
  { id: 'C', name: 'Out', score: 0, connectionState: 'connected', active: true, roundStatus: 'failed' },
]
const results: RoundResultEntry[] = [
  { playerId: 'B', position: 1, status: 'solved', errors: 1, resolutionTimeMs: 1250, pointsAwarded: 3 },
  { playerId: 'D', position: 2, status: 'solved', errors: 6, resolutionTimeMs: 31000, pointsAwarded: 1 },
  { playerId: 'C', position: 3, status: 'failed', errors: 6, resolutionTimeMs: 2500, pointsAwarded: 0 },
  { playerId: 'A', position: null, status: 'setter', errors: null, resolutionTimeMs: null, pointsAwarded: 0 },
]
const resultMarkup = renderToStaticMarkup(<RoundResults results={results} players={players} t={multiplayerTranslations.es} />)
assert.match(resultMarkup, /class="round-result-points"[^>]*>\+3/)
assert.match(resultMarkup, /Winner/)
assert.match(resultMarkup, /🟢/)
assert.match(resultMarkup, /1 error · 1.3 s/)
assert.match(resultMarkup, /Forgiven/)
assert.match(resultMarkup, /🟡/)
assert.match(resultMarkup, /6 errores · 31 s · Perdonada/)
assert.match(resultMarkup, /Ahorcado/)
assert.match(resultMarkup, /Setter/)
assert.match(resultMarkup, /Palabra/)
assert.match(resultMarkup, /\+0/)
assert.doesNotMatch(resultMarkup, /<table|<thead|Pos\./)
assert.ok(resultMarkup.indexOf('Winner') < resultMarkup.indexOf('Forgiven'))
assert.ok(resultMarkup.indexOf('Forgiven') < resultMarkup.indexOf('Out'))
assert.ok(resultMarkup.indexOf('Out') < resultMarkup.indexOf('Setter'))

const catalanResults = renderToStaticMarkup(<RoundResults results={results} players={players} t={multiplayerTranslations.ca} />)
assert.match(catalanResults, /1 error · 1.3 s/)
assert.match(catalanResults, /6 errors · 31 s · Perdonada/)
assert.match(catalanResults, /Penjat/)
assert.match(catalanResults, /Paraula/)

const request = { id: 'request-1', roundId: 'round-1', playerId: 'C', setterId: 'A', status: 'pending' as const, createdAt: 1, decidedAt: null }
assert.equal(renderToStaticMarkup(<ForgivenessTray requests={[]} players={players} t={multiplayerTranslations.ca} onDecide={() => {}} />), '')
const trayMarkup = renderToStaticMarkup(<ForgivenessTray requests={[request]} players={players} t={multiplayerTranslations.ca} onDecide={() => {}} />)
assert.match(trayMarkup, /Peticions de perdó/)
assert.match(trayMarkup, /Out/)
assert.match(trayMarkup, /Perdonar la vida/)

console.log('Multiplayer terminal-state and round-result UI checks passed')
