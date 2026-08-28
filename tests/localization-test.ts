import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { INTERFACE_LANGUAGE_STORAGE_KEY, readInterfaceLanguage } from '../src/localization'
import { HowToPlayPage } from '../src/pages/HowToPlayPage'
import { normalizeRoute } from '../src/routing'

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

console.log('Localization routing checks passed')
