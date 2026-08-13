import type { Language } from '../shared/game'

export const INTERFACE_LANGUAGE_STORAGE_KEY = 'hangman-interface-language'

export function readInterfaceLanguage(storage: Pick<Storage, 'getItem'>): Language {
  const stored = storage.getItem(INTERFACE_LANGUAGE_STORAGE_KEY)
  return stored === 'es' || stored === 'ca' ? stored : 'ca'
}
