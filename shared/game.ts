export type Language = 'es' | 'ca'

export const ALPHABETS: Record<Language, readonly string[]> = {
  es: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split(''),
  ca: 'ABCÇDEFGHIJKLMNOPQRSTUVXYZ'.split(''),
}

const ACCENTS: Record<string, string> = {
  A: 'AÁÀ', E: 'EÉÈ', I: 'IÍÏ', O: 'OÓÒ', U: 'UÚÜ',
}

export function normalizeGuess(value: string, language: Language): string | null {
  if (typeof value !== 'string' || [...value].length !== 1) return null
  const letter = value.toLocaleUpperCase(language)
  const normalized = Object.entries(ACCENTS).find(([, variants]) => variants.includes(letter))?.[0] ?? letter
  return ALPHABETS[language].includes(normalized) ? normalized : null
}

export function isCorrectGuess(word: string, guess: string, language: Language): boolean {
  return [...word].some((character) => normalizeGuess(character, language) === guess)
}

export function displayWord(word: string, guesses: ReadonlySet<string>, language: Language, reveal = false): string[] {
  return [...word].map((character) => {
    const normalized = normalizeGuess(character, language)
    return normalized === null || reveal || guesses.has(normalized) ? character : '_'
  })
}

export function isWordComplete(word: string, guesses: ReadonlySet<string>, language: Language): boolean {
  return !displayWord(word, guesses, language).includes('_')
}

export function validateSecretWord(input: unknown, language: Language): string | null {
  if (typeof input !== 'string') return null
  const word = input.trim().replace(/\s+/g, ' ').toLocaleUpperCase(language)
  if (!word || word.length > 50) return null
  const punctuation = new Set([' ', "'", '’', '-', '·'])
  if (![...word].every((character) => normalizeGuess(character, language) !== null || punctuation.has(character))) return null
  return [...word].some((character) => normalizeGuess(character, language) !== null) ? word : null
}
