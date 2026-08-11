import { catalanWords } from './words/catalan'
import { spanishWords } from './words/spanish'

export type Language = 'es' | 'ca'

export type Translations = {
  title: string
  subtitle: string
  chooseLanguage: string
  newGame: string
  errors: string
  incorrectLetters: string
  noIncorrectLetters: string
  win: string
  lose: string
  wordWas: string
  playAgain: string
  keyboardLabel: string
  progressLabel: string
}

export type LanguageConfig = {
  name: string
  locale: string
  alphabet: readonly string[]
  words: readonly string[]
  translations: Translations
}

const commonLetters = 'ABCDEFGHIJKLMN'.split('')
const endLetters = 'OPQRSTUVWXYZ'.split('')
const catalanLetters = 'ABCÇDEFGHIJKLMNOPQRSTUVXYZ'.split('')

export const languages: Record<Language, LanguageConfig> = {
  es: {
    name: 'Español',
    locale: 'es',
    alphabet: [...commonLetters, 'Ñ', ...endLetters],
    words: spanishWords,
    translations: {
      title: 'Ahorcado', subtitle: 'Adivina la palabra letra a letra',
      chooseLanguage: 'Idioma', newGame: 'Nueva partida', errors: 'Errores',
      incorrectLetters: 'Letras incorrectas', noIncorrectLetters: 'Ninguna todavía',
      win: '¡Has ganado!', lose: 'Has perdido', wordWas: 'La palabra era',
      playAgain: 'Jugar de nuevo', keyboardLabel: 'Teclado de letras',
      progressLabel: 'Progreso de la palabra',
    },
  },
  ca: {
    name: 'Català',
    locale: 'ca',
    alphabet: catalanLetters,
    words: catalanWords,
    translations: {
      title: 'Penjat', subtitle: 'Endevina la paraula lletra a lletra',
      chooseLanguage: 'Llengua', newGame: 'Nova partida', errors: 'Errors',
      incorrectLetters: 'Lletres incorrectes', noIncorrectLetters: 'Cap encara',
      win: 'Has guanyat!', lose: 'Has perdut!', wordWas: 'La paraula era',
      playAgain: 'Torna a jugar', keyboardLabel: 'Teclat de lletres',
      progressLabel: 'Progrés de la paraula',
    },
  },
}

export const getLanguageConfig = (language: Language) => languages[language]
