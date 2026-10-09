import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GameRoom } from '../server/game/GameRoom'
import { MatchResults } from '../src/components/MatchResults'
import { multiplayerTranslations } from '../src/multiplayer/i18n'
import { matchOutcome, matchStandings, outcomeCopy } from '../src/multiplayer/matchResults'
import { GamePage } from '../src/pages/GamePage'
import { matchOverView, matchResultScenarios as scenarios } from './match-results-fixtures'

const ca = multiplayerTranslations.ca
const es = multiplayerTranslations.es
const scenario = (name: string) => scenarios[name]
const standingsOf = (name: string) => matchStandings(scenario(name).view, scenario(name).self)
const copyOf = (name: string, language: 'ca' | 'es') => {
  const standings = standingsOf(name)
  return outcomeCopy(matchOutcome(standings), standings, multiplayerTranslations[language], language)
}
const resultsMarkup = (name: string, language: 'ca' | 'es' = 'ca') => {
  const { view, self } = scenario(name)
  return renderToStaticMarkup(<MatchResults state={view} playerId={self} t={multiplayerTranslations[language]} language={language} onRematch={() => {}} onNewRoom={() => {}} onExitToMenu={() => {}} />)
}
const pageMarkup = (name: string, language: 'ca' | 'es' = 'ca') => {
  const { view, self } = scenario(name)
  return renderToStaticMarkup(<GamePage state={view} playerId={self} interfaceLanguage={language} messages={[]} typingPlayers={[]} onLeave={() => {}} onExitToMenu={() => {}} />)
}
const count = (markup: string, pattern: RegExp) => (markup.match(new RegExp(pattern.source, 'g')) ?? []).length

// --- Standings derivation ---
const ten = standingsOf('ten')!
assert.equal(ten.length, 10, 'every result participant is listed, including departed players')
assert.deepEqual(ten.map(({ rank }) => rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
assert.equal(ten.find(({ id }) => id === 'p6')?.presence, 'departed')
assert.equal(ten.find(({ id }) => id === 'p6')?.score, 15, 'departed players keep their actual score')
assert.equal(ten.find(({ id }) => id === 'p8')?.presence, 'reconnecting')
assert.deepEqual(ten.filter(({ isSelf }) => isSelf).map(({ id }) => id), ['p3'])

const tiedRanks = matchStandings(matchOverView({ players: [5, 5, 5, 3, 3, 1].map((score, index) => ({ id: `t${index}`, name: `T${index}`, score })) }), 't4')!
assert.deepEqual(tiedRanks.map(({ rank }) => rank), [1, 1, 1, 4, 4, 6], 'competition ranks 1, 1, 1, 4, 4, 6')
// Roster order may order rows, but never breaks a scoring tie.
const reversed = matchStandings({ players: scenario('two-tie').view.players, matchResult: { ranking: ['j', 's'], scores: { s: 8, j: 8 } } }, 's')!
assert.deepEqual(reversed.map(({ id, rank }) => [id, rank]), [['j', 1], ['s', 1]])
assert.equal(matchOutcome(reversed).kind, 'self-tied')

// Duplicate names are distinguished by ID; unknown roster IDs remain visible rather than being dropped.
const duplicates = standingsOf('long-names')!
assert.equal(duplicates[0].name, duplicates[1].name)
assert.deepEqual(duplicates.map(({ isSelf }) => isSelf), [false, true, false, false])
const unknown = matchStandings({ players: [], matchResult: { ranking: ['ghost', 'me'], scores: { ghost: 4, me: 2 } } }, 'me')!
assert.deepEqual(unknown.map(({ name, presence }) => [name, presence]), [[null, 'departed'], [null, 'departed']])
assert.deepEqual(matchStandings({ players: [], matchResult: { ranking: ['a', 'a', 'b'], scores: { a: 1, b: 0 } } }, 'a')!.map(({ id }) => id), ['a', 'b'])

// Missing or incomplete snapshots never fabricate scores or a winner.
assert.equal(matchStandings(scenario('missing-result').view, 's'), null)
assert.equal(matchStandings({ players: [], matchResult: { ranking: [], scores: {} } }, 's'), null)
assert.equal(matchStandings({ players: [], matchResult: { ranking: ['a', 'b'], scores: { a: 3 } } }, 'a'), null)
assert.deepEqual(matchOutcome(null), { kind: 'unavailable' })

// --- Outcomes ---
assert.equal(matchOutcome(standingsOf('two-win')).kind, 'self-won')
assert.equal(matchOutcome(standingsOf('two-loss')).kind, 'other-won')
assert.equal(matchOutcome(standingsOf('two-tie')).kind, 'self-tied')
assert.equal(matchOutcome(standingsOf('others-tied')).kind, 'others-tied')
assert.equal(matchOutcome(standingsOf('many-leaders')).kind, 'self-tied')
assert.equal(matchOutcome(standingsOf('all-zero')).kind, 'self-tied', 'all-zero tops are ties, not wins for whoever remained')
assert.equal(matchOutcome(standingsOf('lower-tie')).kind, 'other-won', 'a lower-place tie is not a match draw')
const departedWinner = matchOutcome(standingsOf('departed-winner'))
assert.equal(departedWinner.kind, 'other-won')
assert.equal(departedWinner.kind === 'other-won' && departedWinner.winner.id, 'j', 'a departed leader keeps the win')

// --- Localized copy (CA/ES) ---
const expected: [string, 'ca' | 'es', string, string][] = [
  ['two-win', 'ca', 'Has guanyat!', 'Primer lloc amb 12 punts.'],
  ['two-win', 'es', '¡Has ganado!', 'Primer puesto con 12 puntos.'],
  ['two-loss', 'ca', 'Júlia ha guanyat', 'Has quedat en 2n lloc amb 9 punts.'],
  ['two-loss', 'es', 'Júlia ha ganado', 'Has quedado en 2.º puesto con 9 puntos.'],
  ['two-tie', 'ca', 'Empat al primer lloc', 'Comparteixes el primer lloc amb Júlia, amb 8 punts.'],
  ['two-tie', 'es', 'Empate en el primer puesto', 'Compartes el primer puesto con Júlia, con 8 puntos.'],
  ['others-tied', 'ca', 'Empat al primer lloc', 'Júlia i Marc comparteixen el primer lloc amb 8 punts. Has quedat en 4t lloc amb 3 punts.'],
  ['others-tied', 'es', 'Empate en el primer puesto', 'Júlia y Marc comparten el primer puesto con 8 puntos. Has quedado en 4.º puesto con 3 puntos.'],
  ['many-leaders', 'ca', 'Empat al primer lloc', 'Comparteixes el primer lloc amb Júlia, Marc i Pol, amb 8 punts.'],
  ['all-zero', 'es', 'Empate en el primer puesto', 'Compartes el primer puesto con Júlia y Marc, con 0 puntos.'],
  ['lower-tie', 'ca', 'Júlia ha guanyat', 'Comparteixes el 2n lloc amb 5 punts.'],
  ['lower-tie', 'es', 'Júlia ha ganado', 'Compartes el 2.º puesto con 5 puntos.'],
  ['departed-winner', 'ca', 'Júlia ha guanyat', 'Has quedat en 2n lloc amb 10 punts.'],
  ['ten', 'ca', 'Júlia ha guanyat', 'Has quedat en 4t lloc amb 21 punts.'],
  ['ten', 'es', 'Júlia ha ganado', 'Has quedado en 4.º puesto con 21 puntos.'],
  ['missing-result', 'ca', 'Resultat no disponible', "No s'ha pogut recuperar la classificació final d'aquesta partida."],
  ['missing-result', 'es', 'Resultado no disponible', 'No se ha podido recuperar la clasificación final de esta partida.'],
]
for (const [name, language, heading, lede] of expected) assert.deepEqual(copyOf(name, language), { heading, lede }, `${name} ${language}`)
const fiveLeaders = matchOverView({ players: ['s', 'a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase(), score: id === 'e' ? 1 : 4 })) })
const fiveCopy = (id: string, language: 'ca' | 'es') => { const s = matchStandings(fiveLeaders, id); return outcomeCopy(matchOutcome(s), s, multiplayerTranslations[language], language).lede }
assert.equal(fiveCopy('s', 'ca'), 'Comparteixes el primer lloc amb 4 jugadors més, amb 4 punts.')
assert.equal(fiveCopy('e', 'es'), '5 jugadores comparten el primer puesto con 4 puntos. Has quedado en 6.º puesto con 1 punto.')
assert.deepEqual([1, 2, 3, 4, 5, 10].map(ca.ordinal), ['1r', '2n', '3r', '4t', '5è', '10è'])
assert.deepEqual([1, 2, 3, 4, 10].map(es.ordinal), ['1.er', '2.º', '3.er', '4.º', '10.º'])
for (const key of Object.keys(es) as (keyof typeof es)[]) assert.equal(typeof ca[key], typeof es[key], `${key} is translated in both languages`)
console.log('Match outcome, standings and localized copy checks passed')

// --- Match-over replaces gameplay ---
for (const language of ['ca', 'es'] as const) {
  for (const name of Object.keys(scenarios)) {
    const markup = pageMarkup(name, language)
    assert.doesNotMatch(markup, /class="(scoreboard|keyboard|game-columns|drawing-panel|word-form|round-result"|forgiveness-tray|multiplayer-game)/, `${name}: gameplay surface is not rendered`)
    assert.doesNotMatch(markup, /class="hangman/)
    assert.equal(count(markup, /class="match-results /), 1)
    assert.ok(count(markup, /class="match-standings"/) <= 1, 'one authoritative classification')
    assert.equal(count(markup, /class="room-chat( is-empty)?"/), 1, 'chat stays available')
    assert.equal(count(markup, /<h2 id="match-outcome-title" tabindex="-1" aria-describedby="match-outcome-lede">/), 1)
  }
}
assert.match(pageMarkup('two-win'), /class="match-meta"><span>Codi de sala <b>K7QF2<\/b><\/span><span>Català<\/span><\/div>/, 'compact room header without turn counters')

// Rows: one visible, independent self marker by ID; long/duplicate names; multiple-digit scores; departed status.
const tenMarkup = resultsMarkup('ten')
assert.equal(count(tenMarkup, /<li class="standing-row/), 10)
assert.equal(count(tenMarkup, /class="standing-self"/), 1)
assert.match(tenMarkup, /class="standing-row is-self"><span class="standing-rank" aria-hidden="true">4<\/span>[^]*?standing-name">Sergio<\/span><span class="standing-self"><span class="sr-only">, <\/span>Tu<\/span>/)
assert.match(tenMarkup, /class="standing-row is-departed">[^]*?Biel[^]*?Ha sortit de la sala[^]*?<span aria-hidden="true">15<\/span>/)
assert.match(tenMarkup, /class="standing-row is-reconnecting">[^]*?Quim[^]*?Reconnectant…/)
assert.match(tenMarkup, /class="standing-row is-leader">[^]*?Júlia/)
assert.match(tenMarkup, /<span class="sr-only">1r lloc: <\/span>/)
assert.match(tenMarkup, /<span class="sr-only">, 27 punts<\/span>/)
assert.match(tenMarkup, /<ol role="list">/)
assert.match(tenMarkup, /aria-labelledby="match-standings-title"/)
const longMarkup = resultsMarkup('long-names', 'es')
assert.equal(count(longMarkup, /standing-name">Maria Antònia Fernández de Castro i Vilallonga</), 2)
assert.match(longMarkup, /class="standing-row is-self"><span class="standing-rank" aria-hidden="true">2<\/span>[^]*?<span class="standing-self"><span class="sr-only">, <\/span>Tú<\/span>/)
assert.match(longMarkup, /<span aria-hidden="true">128<\/span>/)
assert.match(resultsMarkup('departed-winner', 'es'), /class="standing-row is-leader is-departed">[^]*?Júlia[^]*?Ha salido de la sala[^]*?<span aria-hidden="true">14<\/span>/)
assert.match(resultsMarkup('two-win'), /class="match-outcome-mark" aria-hidden="true">★<\/span>Has guanyat!/)
assert.doesNotMatch(resultsMarkup('two-loss'), /match-outcome-mark/)
const unavailableResult = resultsMarkup('missing-result', 'es')
assert.match(unavailableResult, /Resultado no disponible/)
assert.doesNotMatch(unavailableResult, /match-standings|standing-row|ha ganado/)

// Last round: collapsed native disclosure with word and results; nothing word-related for an interrupted turn.
const details = resultsMarkup('two-win').match(/<details[^]*<\/details>/)?.[0] ?? ''
assert.match(details, /^<details class="match-round-details"><summary>Detalls de l&#x27;última ronda<\/summary>/)
assert.doesNotMatch(details, /<details[^>]* open/)
assert.match(details, /La paraula era: <strong lang="ca">PLATJA<\/strong>/)
assert.match(details, /Paraula de Júlia/)
assert.match(details, /class="round-results" aria-label="Resultat de la ronda"/)
assert.doesNotMatch(details, /<h2 id="round-results-title"/)
for (const language of ['ca', 'es'] as const) {
  const interrupted = resultsMarkup('interrupted', language)
  assert.ok(interrupted.includes(multiplayerTranslations[language].roundInterrupted))
  assert.doesNotMatch(interrupted, /<details|match-round-word|round-results/)
  assert.ok(!interrupted.includes(multiplayerTranslations[language].wordWas))
}
console.log('Match-over rendering checks passed')

// --- Rematch states ---
const rematchButton = (label: string) => new RegExp(`<button type="button" class="primary-action">${label}</button>`)
const twoWin = resultsMarkup('two-win')
assert.match(twoWin, rematchButton('Revenja'))
assert.match(twoWin, /<button type="button" class="secondary-action">Surt al menú<\/button>/)
assert.match(twoWin, /<span aria-live="polite">0 de 2 jugadors preparats<\/span>/)
assert.ok(twoWin.indexOf('match-actions') < twoWin.indexOf('match-standings'), 'rematch comes before the classification')
assert.ok(twoWin.indexOf('match-outcome-title') < twoWin.indexOf('match-actions'))
assert.match(resultsMarkup('two-win', 'es'), /<button type="button" class="primary-action">Revancha<\/button><button type="button" class="secondary-action">Salir al menú<\/button>/)

const ready = resultsMarkup('ready-waiting')
assert.doesNotMatch(ready, /class="primary-action"/, 'a ready player sees no actionable rematch button')
assert.match(ready, /<p class="rematch-requested" tabindex="-1"><span class="rematch-requested-mark" aria-hidden="true">✓<\/span>Revenja sol·licitada<\/p>/)
assert.match(ready, /<span aria-live="polite">2 de 4 jugadors preparats<\/span>/)
assert.equal(count(ready, /<i class="on">/), 2)
assert.equal(count(ready, /<i><\/i>|<i class="on"><\/i>/), 4)
assert.match(resultsMarkup('ready-waiting', 'es'), /Revancha solicitada[^]*2 de 4 jugadores listos/)

// Others ready, self not: still actionable, counts reflect them.
assert.match(resultsMarkup('four-tie-departed'), rematchButton('Revenja'))
assert.match(resultsMarkup('four-tie-departed'), /1 de 3 jugadors preparats/, 'departed players are not in the readiness denominator')
// Ten players: departed excluded, reconnecting still counted until the server removes them.
assert.match(tenMarkup, /2 de 9 jugadors preparats/)
assert.equal(count(tenMarkup, /<i class="on">|<i><\/i>/), 9)
assert.match(tenMarkup, /class="rematch-note" role="status">Esperant la reconnexió de Quim.<\/p>/)
assert.match(resultsMarkup('reconnecting', 'es'), /Esperando la reconexión de Júlia.[^]*1 de 3 jugadores listos/)
// Fewer than two active players: explanation and navigation, never an impossible rematch.
for (const language of ['ca', 'es'] as const) {
  const t = multiplayerTranslations[language]
  const markup = resultsMarkup('unavailable', language)
  assert.ok(markup.includes(t.rematchNotEnough) && markup.includes(t.rematchNotEnoughBody))
  assert.match(markup, new RegExp(`<button type="button" class="primary-action">${t.createNewRoom}</button><button type="button" class="secondary-action">${t.exitToMenu}</button>`))
  assert.ok(!markup.includes(`>${t.rematch}<`) && !markup.includes('rematch-readiness'))
}
// Spanish screens contain no Catalan interface labels.
const spanishTen = resultsMarkup('ten', 'es')
for (const catalan of ['Revenja', 'Surt al menú', 'Classificació', 'Detalls', 'jugadors', 'punts', 'Ha sortit', 'Reconnectant']) assert.ok(!spanishTen.includes(catalan), `Spanish markup has no "${catalan}"`)
assert.match(spanishTen, /Clasificación final[^]*Puntos/)
console.log('Rematch state rendering checks passed')

// --- Real server snapshots (2 and 10 players) ---
function completedRoom(count: number) {
  const room = new GameRoom('MR234', 'ca', 1, () => 0)
  for (let i = 0; i < count; i++) room.addPlayer(String(i), `s${i}`, `t${i}`, `Player ${i}`)
  room.start('0')
  for (let i = 0; i < count; i++) {
    room.setWord(String(i), 'A')
    for (const player of room.activePlayers.filter((p) => p.id !== String(i))) room.guess(player.id, 'A')
    if (i + 1 < count) room.continue(String(i + 1))
  }
  return room
}
const serverResults = (room: GameRoom, id: string, language: 'ca' | 'es' = 'ca') => renderToStaticMarkup(<MatchResults state={room.viewFor(id)} playerId={id} t={multiplayerTranslations[language]} language={language} onRematch={() => {}} onNewRoom={() => {}} onExitToMenu={() => {}} />)
const serverTen = completedRoom(10)
const serverStandings = matchStandings(serverTen.viewFor('5'), '5')!
assert.equal(serverStandings.length, 10)
assert.deepEqual(serverStandings.map(({ id, score }) => [id, score]), serverTen.viewFor('5').matchResult!.ranking.map((id) => [id, serverTen.viewFor('5').matchResult!.scores[id]]))
assert.match(serverResults(serverTen, '5'), /0 de 10 jugadors preparats/)
serverTen.requestRematch('5'); serverTen.requestRematch('2'); serverTen.markReconnecting('7', 's7'); serverTen.disconnect('9')
const tenAfter = serverResults(serverTen, '5')
assert.match(tenAfter, /2 de 9 jugadors preparats/)
assert.match(tenAfter, /Revenja sol·licitada/)
assert.match(tenAfter, /Esperant la reconnexió de Player 7/)
assert.equal(count(tenAfter, /<li class="standing-row/), 10, 'departure keeps the historical result row')
const serverTwo = completedRoom(2)
assert.match(serverResults(serverTwo, '1'), /0 de 2 jugadors preparats/)
serverTwo.requestRematch('0')
assert.match(serverResults(serverTwo, '1'), /1 de 2 jugadors preparats/)
assert.match(serverResults(serverTwo, '1'), rematchButton('Revenja'))
assert.match(serverResults(serverTwo, '0'), /Revenja sol·licitada/)
serverTwo.disconnect('1')
assert.match(serverResults(serverTwo, '0', 'es'), /No hay suficientes jugadores para empezar una revancha/)
console.log('Server-snapshot match results checks passed')

// --- Accessibility structure ---
const a11y = resultsMarkup('two-tie')
assert.match(a11y, /<section class="match-results outcome-self-tied" aria-labelledby="match-outcome-title">/)
assert.match(a11y, /<p id="match-outcome-lede" class="match-outcome-lede">Comparteixes/)
assert.equal(count(a11y, /role="status"/), 1, 'one announcement region; readiness uses its own polite text only')
assert.match(a11y, /<p class="sr-only" role="status"><\/p>/, 'announcement region starts empty and is filled once on transition')
assert.equal(count(a11y, /aria-live="polite"/), 1)
console.log('Match results accessibility structure checks passed')
