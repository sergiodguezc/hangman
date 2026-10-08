import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { INTERFACE_LANGUAGE_STORAGE_KEY, readInterfaceLanguage } from '../src/localization'
import { HowToPlayPage } from '../src/pages/HowToPlayPage'
import { normalizeRoute } from '../src/routing'
import { HomePage } from '../src/pages/HomePage'
import { getDailyChallenge } from '../src/daily/challenge'
import { dailyTranslations } from '../src/daily/i18n'
import { homeTranslations } from '../src/home/i18n'
import { ALPHABETS, isCorrectGuess } from '../shared/game'

const storage = (value: string | null) => ({ getItem: (key: string) => key === INTERFACE_LANGUAGE_STORAGE_KEY ? value : null })

assert.equal(readInterfaceLanguage(storage(null)), 'ca')
assert.equal(readInterfaceLanguage(storage('es')), 'es')
assert.equal(readInterfaceLanguage(storage('ca')), 'ca')
assert.equal(readInterfaceLanguage(storage('invalid')), 'ca')

assert.equal(normalizeRoute('/'), '/')
assert.equal(normalizeRoute('/multijugador'), '/multijugador/')
assert.equal(normalizeRoute('/com-es-juga/'), '/com-es-juga/')
assert.equal(normalizeRoute('/es'), '/')
assert.equal(normalizeRoute('/es/'), '/')
assert.equal(normalizeRoute('/es/multijugador/'), '/multijugador/')
assert.equal(normalizeRoute('/es/como-jugar/'), '/com-es-juga/')

const howToCa = renderToStaticMarkup(React.createElement(HowToPlayPage, { language: 'ca' }))
const howToEs = renderToStaticMarkup(React.createElement(HowToPlayPage, { language: 'es' }))
assert.match(howToCa, /Voltes i torns/)
assert.match(howToCa, /Puntuació/)
assert.match(howToCa, /Qui l’ha triada pot observar el progrés de cada jugador/)
assert.match(howToCa, /millor rep \+3, el segon \+2 i el tercer \+1/)
assert.match(howToCa, /Ja no són a la sala/)
assert.match(howToEs, /Vueltas y turnos/)
assert.match(howToEs, /Puntuación/)
assert.match(howToEs, /Quien la ha elegido puede observar el progreso de cada jugador/)
assert.match(howToEs, /el mejor recibe \+3, el segundo \+2 y el tercero \+1/)
assert.match(howToEs, /Ya no están en la sala/)
assert.doesNotMatch(howToCa, /Socket\.IO|RoundResult|servidor|cliente/)
assert.doesNotMatch(howToEs, /Socket\.IO|RoundResult|servidor|cliente/)

// Approved F1 strings (docs/design/phase-2-1-final.md §6.2), pinned literally.
assert.deepEqual(homeTranslations, {
  ca: { lede: 'Tria una paraula i repta els amics a endevinar-la. Sense registre.', modes: 'Modes de joc', multiplayer: 'Juga amb amics', multiplayerCaption: 'Crea una sala · de 2 a 10', learning: 'Aprendre català', learningCaption: 'En solitari, amb pistes' },
  es: { lede: 'Elige una palabra y reta a tus amigos a adivinarla. Sin registro.', modes: 'Modos de juego', multiplayer: 'Juega con amigos', multiplayerCaption: 'Crea una sala · de 2 a 10', learning: 'Aprender catalán', learningCaption: 'En solitario, con pistas' },
})
for (const [language, title, fresh, won0, lost, tomorrow] of [
  ['ca', 'Paraula del dia', 'La mateixa per a tothom', 'Encertada sense errors', 'No ha pogut ser', 'torna demà'],
  ['es', 'Palabra del día', 'La misma para todos', 'Acertada sin errores', 'No ha podido ser', 'vuelve mañana'],
] as const) {
  const d = dailyTranslations[language]
  assert.deepEqual([d.title, d.sameForEveryone, d.wonWith(0), d.lost, d.comeBackTomorrow], [title, fresh, won0, lost, tomorrow])
}

const challenge = getDailyChallenge()
const restoreStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
let attempt: string | null = null
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key === 'penjat-daily-challenge' ? attempt : null } })
try {
  for (const language of ['ca', 'es'] as const) {
    const d = dailyTranslations[language]
    const copy = homeTranslations[language]
    for (const state of ['new', 'won', 'lost'] as const) {
      const guesses = state === 'won' ? ALPHABETS.ca.filter((letter) => isCorrectGuess(challenge.entry.answerCa, letter, 'ca')) : state === 'lost' ? ALPHABETS.ca.filter((letter) => !isCorrectGuess(challenge.entry.answerCa, letter, 'ca')).slice(0, 6) : []
      attempt = JSON.stringify({ challengeId: challenge.id, guesses })
      const html = renderToStaticMarkup(React.createElement(HomePage, {
        interfaceLanguage: language, gameLanguage: 'ca', mode: 'home',
        onGameLanguage() {}, onEnter() {}, onLearn() {}, onDaily() {}, onMultiplayer() {}, onHelp() {},
      }))
      assert.equal((html.match(/<h1>/g) ?? []).length, 1)
      assert.ok(html.includes(language === 'ca' ? '<h1>Juga al penjat online en català.</h1>' : '<h1>Juega a Penjat online.</h1>'))
      assert.ok(html.includes(`<nav class="home-modes" aria-label="${copy.modes}">`))
      const nav = html.match(/<nav class="home-modes".*?<\/nav>/)![0]
      assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), ['/multijugador', '/aprendre', '/paraula-del-dia'])
      for (const text of Object.values(copy)) assert.ok(html.includes(text), text)
      for (const [, id] of nav.matchAll(/aria-describedby="([^"]+)"/g)) assert.ok(html.includes(`id="${id}"`))
      assert.ok(nav.includes(`#${challenge.number}`))
      assert.ok(nav.includes(state === 'new' ? d.sameForEveryone : state === 'won' ? d.wonWith(0) : d.lost))
      assert.equal(nav.includes(d.comeBackTomorrow), state !== 'new')
      assert.ok(!nav.replace(d.title, '').toLowerCase().includes(challenge.entry.answerCa.toLowerCase()))
      assert.ok(!html.includes(challenge.entry.definitionCa))
      assert.ok(!nav.includes('<button'))
    }
    assert.equal(d.wonWith(1), language === 'ca' ? 'Encertada amb 1 error' : 'Acertada con 1 error')
    assert.equal(d.wonWith(2), language === 'ca' ? 'Encertada amb 2 errors' : 'Acertada con 2 errores')
  }
} finally {
  if (restoreStorage) Object.defineProperty(globalThis, 'localStorage', restoreStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}
console.log('Localization routing and homepage semantic markup checks passed')
