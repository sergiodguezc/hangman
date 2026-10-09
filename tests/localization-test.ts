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
import { multiplayerTranslations } from '../src/multiplayer/i18n'
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

const F1_KEYS = ['lede', 'modes', 'multiplayer', 'multiplayerCaption', 'learning', 'learningCaption']
const PHASE_3C_KEYS = ['play', 'playCaption', 'quickLearning', 'dailyPlayed']
// Approved F1 strings (docs/design/phase-2-1-final.md §6.2), pinned literally.
assert.deepEqual(Object.fromEntries(Object.entries(homeTranslations).map(([language, copy]) => [language, Object.fromEntries(Object.entries(copy).filter(([key]) => F1_KEYS.includes(key)))])), {
  ca: { lede: 'Tria una paraula i repta els amics a endevinar-la. Sense registre.', modes: 'Modes de joc', multiplayer: 'Juga amb amics', multiplayerCaption: 'Crea una sala · de 2 a 10', learning: 'Aprendre català', learningCaption: 'En solitari, amb pistes' },
  es: { lede: 'Elige una palabra y reta a tus amigos a adivinarla. Sin registro.', modes: 'Modos de juego', multiplayer: 'Juega con amigos', multiplayerCaption: 'Crea una sala · de 2 a 10', learning: 'Aprender catalán', learningCaption: 'En solitario, con pistas' },
})
// Phase 3B homepage additions (eyebrow, mode cards and preview), pinned literally.
assert.deepEqual(Object.fromEntries(Object.entries(homeTranslations).map(([language, copy]) => [language, Object.fromEntries(Object.entries(copy).filter(([key]) => !F1_KEYS.includes(key) && !PHASE_3C_KEYS.includes(key)))])), {
  ca: { eyebrow: 'El joc del penjat', cardsTitle: 'Tria com vols jugar', multiplayerCard: 'Sales privades de 2 a 10 persones. A cada torn, algú tria la paraula i la resta l’endevina.', multiplayerCardAction: 'Crea una sala', dailyCard: 'Una paraula nova cada dia, la mateixa per a tothom. Comparteix el resultat sense revelar-la.', dailyCardAction: 'Juga la d’avui', learningCard: 'Vocabulari català real amb una pista en castellà. En acabar, veus el significat i un exemple.', learningCardAction: 'Comença a practicar', helpCard: 'Regles, torns, puntuació i perdó, explicats pas a pas.', helpCardAction: 'Llegeix les regles', previewTag: '6 lletres' },
  es: { eyebrow: 'El juego del ahorcado', cardsTitle: 'Elige cómo quieres jugar', multiplayerCard: 'Salas privadas de 2 a 10 personas. En cada turno, alguien elige la palabra y el resto la adivina.', multiplayerCardAction: 'Crea una sala', dailyCard: 'Una palabra nueva cada día, la misma para todos. Comparte el resultado sin revelarla.', dailyCardAction: 'Juega la de hoy', learningCard: 'Vocabulario catalán real con una pista en español. Al terminar, ves el significado y un ejemplo.', learningCardAction: 'Empieza a practicar', helpCard: 'Reglas, turnos, puntuación y perdón, explicados paso a paso.', helpCardAction: 'Lee las reglas', previewTag: '6 letras' },
})
// Phase 3C phone hero actions, pinned literally.
assert.deepEqual(Object.fromEntries(Object.entries(homeTranslations).map(([language, copy]) => [language, Object.fromEntries(Object.entries(copy).filter(([key]) => PHASE_3C_KEYS.includes(key)))])), {
  ca: { play: 'Jugar', playCaption: 'Amb amics · de 2 a 10', quickLearning: 'Aprèn català', dailyPlayed: 'Jugada' },
  es: { play: 'Jugar', playCaption: 'Con amigos · de 2 a 10', quickLearning: 'Aprende catalán', dailyPlayed: 'Jugada' },
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
      // Phase 3B styles one accent word inside the heading; its text (the SEO headline) is unchanged.
      assert.equal(html.match(/<h1>(.*?)<\/h1>/)![1].replace(/<[^>]+>/g, ''), language === 'ca' ? 'Juga al penjat online en català.' : 'Juega a Penjat online.')
      assert.ok(html.includes(`<nav class="home-modes" aria-label="${copy.modes}">`))
      const nav = html.match(/<nav class="home-modes".*?<\/nav>/)![0]
      assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), ['/multijugador', '/aprendre', '/paraula-del-dia'])
      for (const [key, text] of Object.entries(copy)) if (key !== 'dailyPlayed') assert.ok(html.includes(text), text)
      for (const [, id] of nav.matchAll(/aria-describedby="([^"]+)"/g)) assert.ok(html.includes(`id="${id}"`))
      assert.ok(nav.includes(`#${challenge.number}`))
      assert.ok(nav.includes(state === 'new' ? d.sameForEveryone : state === 'won' ? d.wonWith(0) : d.lost))
      assert.equal(nav.includes(d.comeBackTomorrow), state !== 'new')
      assert.ok(!nav.replace(d.title, '').toLowerCase().includes(challenge.entry.answerCa.toLowerCase()))
      assert.ok(!html.includes(challenge.entry.definitionCa))
      assert.ok(!nav.includes('<button'))
      // Phase 3C phone hero: same destinations, one primary "Jugar", two secondary cards; the daily tag marks a played day.
      assert.ok(html.includes(`<nav class="home-quick" aria-label="${copy.modes}">`))
      const quick = html.match(/<nav class="home-quick".*?<\/nav>/)![0]
      assert.deepEqual([...quick.matchAll(/<a class="([^"]+)" href="([^"]+)"/g)].map((match) => [match[1], match[2]]), [['quick-play', '/multijugador'], ['quick-card quick-card--learn', '/aprendre'], ['quick-card quick-card--daily', '/paraula-del-dia']])
      assert.deepEqual([...quick.matchAll(/<a [^>]*>(.*?)<\/a>/g)].map((match) => match[1].replace(/<[^>]+>/g, '')),
        [`${copy.play}${copy.playCaption}→`, copy.quickLearning, `${d.title}#${challenge.number}${state === 'new' ? '' : ` ✓ · ${copy.dailyPlayed}`}`])
      assert.ok(!quick.replace(d.title, '').toLowerCase().includes(challenge.entry.answerCa.toLowerCase()))
      assert.ok(!quick.includes('<button'))
    }
    assert.equal(d.wonWith(1), language === 'ca' ? 'Encertada amb 1 error' : 'Acertada con 1 error')
    assert.equal(d.wonWith(2), language === 'ca' ? 'Encertada amb 2 errors' : 'Acertada con 2 errores')
  }
  // Multiplayer setup: the name is step 1 and leads the form; creating and joining follow as step 2. Without a window
  // (static render, as on desktop first paint) both panels render open with plain headings and no disclosure buttons.
  for (const language of ['ca', 'es'] as const) {
    const t = multiplayerTranslations[language]
    const html = renderToStaticMarkup(React.createElement(HomePage, {
      interfaceLanguage: language, gameLanguage: 'ca', mode: 'multiplayer',
      onGameLanguage() {}, onEnter() {}, onLearn() {}, onMultiplayer() {}, onHelp() {},
    }))
    const form = html.match(/<form>.*<\/form>/)![0]
    const order = ['setup-name-card', 'setup-next', 'setup-panel--create', 'setup-panel--join'].map((name) => form.indexOf(name))
    assert.ok(order.every((index, i) => index >= 0 && (i === 0 || index > order[i - 1])), `setup order ${order}`)
    assert.ok(form.includes(`<label class="setup-name"><span class="setup-name-title">${t.name}</span><input`))
    assert.match(form, /<input[^>]*aria-describedby="setup-name-hint"/)
    assert.ok(form.includes(`<p class="setup-name-hint" id="setup-name-hint">${t.nameHint}</p>`))
    assert.ok(form.includes(t.nextStep))
    assert.ok(form.includes(`<h2>${t.createTitle}</h2>`) && form.includes(`<h2>${t.joinTitle}</h2>`))
    assert.ok(!form.includes('setup-toggle') && !form.includes(' hidden'))
  }
  assert.deepEqual([multiplayerTranslations.ca.nameHint, multiplayerTranslations.ca.nextStep, multiplayerTranslations.es.nameHint, multiplayerTranslations.es.nextStep],
    ['Així et veurà la resta de la sala.', 'Després, tria com jugar', 'Así te verá el resto de la sala.', 'Después, elige cómo jugar'])
} finally {
  if (restoreStorage) Object.defineProperty(globalThis, 'localStorage', restoreStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
}
console.log('Localization routing and homepage semantic markup checks passed')
