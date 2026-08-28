import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PublicPlayer, RoundResultEntry } from '../shared/protocol'
import { ForgivenessTray } from '../src/components/ForgivenessTray'
import { ObserverSelector } from '../src/components/ObserverSelector'
import { PlayerRoundStatusNotice } from '../src/components/PlayerRoundStatusNotice'
import { RoundResults } from '../src/components/RoundResults'
import { Scoreboard } from '../src/components/Scoreboard'
import { multiplayerTranslations } from '../src/multiplayer/i18n'

const solvedCa = renderToStaticMarkup(<PlayerRoundStatusNotice status="solved" t={multiplayerTranslations.ca} />)
const solvedEs = renderToStaticMarkup(<PlayerRoundStatusNotice status="solved" t={multiplayerTranslations.es} />)
const eliminated = renderToStaticMarkup(<PlayerRoundStatusNotice status="eliminated" t={multiplayerTranslations.ca} />)
assert.match(solvedCa, /Has encertat la paraula!/)
assert.match(solvedCa, /role="status"/)
assert.match(solvedEs, /¡Has acertado la palabra!/)
assert.match(eliminated, /Has quedat fora/)

const players: PublicPlayer[] = [
  { id: 'A', name: 'Player A', score: 0, connectionState: 'connected', active: true, roundStatus: 'setter' },
  { id: 'B', name: 'Winner', score: 2, connectionState: 'connected', active: true, roundStatus: 'solved' },
  { id: 'D', name: 'Forgiven', score: 1, connectionState: 'connected', active: true, roundStatus: 'solved' },
  { id: 'C', name: 'Out', score: 0, connectionState: 'connected', active: true, roundStatus: 'failed' },
]
const results: RoundResultEntry[] = [
  { playerId: 'B', position: 1, status: 'solved', forgiven: false, errors: 1, resolutionTimeMs: 1250, pointsAwarded: 3 },
  { playerId: 'D', position: 2, status: 'solved', forgiven: true, errors: 6, resolutionTimeMs: 31000, pointsAwarded: 1 },
  { playerId: 'C', position: 3, status: 'failed', forgiven: false, errors: 6, resolutionTimeMs: 2500, pointsAwarded: 0 },
  { playerId: 'A', position: null, status: 'setter', forgiven: false, errors: null, resolutionTimeMs: null, pointsAwarded: 0 },
]
const resultMarkup = renderToStaticMarkup(<RoundResults results={results} players={players} t={multiplayerTranslations.es} />)
assert.match(resultMarkup, /class="round-result-points"[^>]*>\+3/)
assert.match(resultMarkup, /class="round-result-row outcome-solved"/)
assert.match(resultMarkup, /Winner/)
assert.match(resultMarkup, /class="sr-only">Palabra acertada<\/span>/)
assert.match(resultMarkup, /1 error · 1.3 s/)
assert.match(resultMarkup, /Forgiven/)
assert.match(resultMarkup, /class="round-result-row outcome-forgiven"/)
assert.match(resultMarkup, /class="sr-only">Palabra acertada después del perdón<\/span>/)
assert.match(resultMarkup, /6 errores · 31 s · Perdonada/)
assert.match(resultMarkup, /Ahorcado/)
assert.match(resultMarkup, /class="round-result-row outcome-failed"/)
assert.doesNotMatch(resultMarkup, /2.5 s/)
assert.match(resultMarkup, /Player A/)
assert.match(resultMarkup, /Palabra/)
assert.match(resultMarkup, /class="round-result-row outcome-setter"/)
assert.equal((resultMarkup.match(/round-result-status-dot/g) ?? []).length, 0)
assert.doesNotMatch(resultMarkup, /round-result-status-dot|round-result-outcome|🟢|🟡|🔴|✏️/)
assert.match(resultMarkup, /\+0/)
assert.doesNotMatch(resultMarkup, /<table|<thead|Pos\./)
assert.ok(resultMarkup.indexOf('Winner') < resultMarkup.indexOf('Forgiven'))
assert.ok(resultMarkup.indexOf('Forgiven') < resultMarkup.indexOf('Out'))
assert.ok(resultMarkup.indexOf('Out') < resultMarkup.indexOf('Player A'))

const catalanResults = renderToStaticMarkup(<RoundResults results={results} players={players} t={multiplayerTranslations.ca} />)
assert.match(catalanResults, /1 error · 1.3 s/)
assert.match(catalanResults, /6 errors · 31 s · Perdonada/)
assert.match(catalanResults, /Penjat/)
assert.match(catalanResults, /Paraula/)

const observerPlayers = Array.from({ length: 9 }, (_, index) => ({ ...players[(index % players.length)], id: `player-${index}`, name: `Player ${index} with a long name` }))
const observerMarkup = renderToStaticMarkup(<ObserverSelector players={observerPlayers} selectedPlayerId="player-7" t={multiplayerTranslations.ca} onSelect={() => {}} />)
assert.match(observerMarkup, /role="tablist"/)
assert.match(observerMarkup, /role="tab"[^>]*aria-selected="true"/)
assert.match(observerMarkup, /title="Player 7 with a long name"/)
assert.match(observerMarkup, /class="observer-tabs"/)
assert.doesNotMatch(observerMarkup, /<strong>Observar jugador<\/strong>/)

const scoreboardPlayers: PublicPlayer[] = [
  { id: 'A', name: 'Manolo 1', score: 4, connectionState: 'disconnected', active: false, roundStatus: 'eliminated' },
  { id: 'B', name: 'Manolo 2', score: 4, connectionState: 'connected', active: true, roundStatus: 'solved' },
  { id: 'C', name: 'Manolo 3', score: 2, connectionState: 'connected', active: true, roundStatus: 'setter' },
]
const scoreboardMarkup = renderToStaticMarkup(<Scoreboard players={scoreboardPlayers} setterId="C" currentId="B" t={multiplayerTranslations.es} />)
const activeClassification = scoreboardMarkup.match(/<ol>.*?<\/ol>/)?.[0] ?? ''
assert.match(activeClassification, /<span class="rank">1<\/span><span class="player-name">Manolo 2 · tú<\/span>/)
assert.match(activeClassification, /<span class="rank">2<\/span><span class="player-name">Manolo 3<\/span>/)
assert.doesNotMatch(activeClassification, /Manolo 1|>3<\/span>/)
assert.match(scoreboardMarkup, /Ya no están en la sala/)
assert.match(scoreboardMarkup, /<section class="departed-players"[^>]*>.*Manolo 1.*<strong>4<\/strong>/)
assert.doesNotMatch(scoreboardMarkup.match(/<section class="departed-players"[\s\S]*?<\/section>/)?.[0] ?? '', /<span class="rank"|ha acertado|elige la palabra/)

const catalanScoreboard = renderToStaticMarkup(<Scoreboard players={scoreboardPlayers} setterId="C" currentId="B" t={multiplayerTranslations.ca} />)
assert.match(catalanScoreboard, /Ja no són a la sala/)
const noDepartedScoreboard = renderToStaticMarkup(<Scoreboard players={players} setterId="A" currentId="B" t={multiplayerTranslations.es} />)
assert.doesNotMatch(noDepartedScoreboard, /departed-players|Ya no están en la sala/)

const request = { id: 'request-1', roundId: 'round-1', playerId: 'C', setterId: 'A', status: 'pending' as const, createdAt: 1, decidedAt: null }
assert.equal(renderToStaticMarkup(<ForgivenessTray requests={[]} players={players} t={multiplayerTranslations.ca} onDecide={() => {}} />), '')
const trayMarkup = renderToStaticMarkup(<ForgivenessTray requests={[request]} players={players} t={multiplayerTranslations.ca} onDecide={() => {}} />)
assert.match(trayMarkup, /Peticions de perdó/)
assert.match(trayMarkup, /Out/)
assert.match(trayMarkup, /Perdonar la vida/)

console.log('Multiplayer terminal-state and round-result UI checks passed')
