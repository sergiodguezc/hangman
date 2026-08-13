import assert from 'node:assert/strict'
import { INTERFACE_LANGUAGE_STORAGE_KEY, readInterfaceLanguage } from '../src/localization'
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

console.log('Localization routing checks passed')
