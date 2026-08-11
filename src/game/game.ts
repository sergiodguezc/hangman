import type { LanguageConfig } from './languages'

const accentGroups: Record<string, string> = {
  A: 'AÁÀ', E: 'EÉÈ', I: 'IÍÏ', O: 'OÓÒ', U: 'UÚÜ',
}

export function normalizeGuess(value: string, config: LanguageConfig): string | null {
  const letter = value.toLocaleUpperCase(config.locale)
  const normalized = Object.entries(accentGroups).find(([, variants]) => variants.includes(letter))?.[0] ?? letter
  return config.alphabet.includes(normalized) ? normalized : null
}

export function isGuessableCharacter(character: string, config: LanguageConfig): boolean {
  return normalizeGuess(character, config) !== null
}

export function characterMatchesGuess(character: string, guess: string, config: LanguageConfig): boolean {
  return normalizeGuess(character, config) === guess
}

export function isCorrectGuess(word: string, guess: string, config: LanguageConfig): boolean {
  return [...word].some((character) => characterMatchesGuess(character, guess, config))
}

export function isWordComplete(word: string, guesses: ReadonlySet<string>, config: LanguageConfig): boolean {
  return [...word].every((character) => {
    const normalized = normalizeGuess(character, config)
    return normalized === null || guesses.has(normalized)
  })
}

export function getRandomWord(words: readonly string[], previous?: string): string {
  if (words.length === 1) return words[0]
  let word = words[Math.floor(Math.random() * words.length)]
  while (word === previous) word = words[Math.floor(Math.random() * words.length)]
  return word
}
