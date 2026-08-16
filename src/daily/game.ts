import { isCorrectGuess, isWordComplete, normalizeGuess } from '../../shared/game'
import type { VocabularyEntry } from '../learning/types'

export const DAILY_MAX_ERRORS = 6

export type DailyResult = 'win' | 'loss'

export type DailyRound = {
  entry: VocabularyEntry
  guesses: Set<string>
  incorrect: Set<string>
  errors: number
  result: DailyResult | null
}

export function createDailyRound(entry: VocabularyEntry, guesses: Iterable<string> = []): DailyRound {
  let round: DailyRound = { entry, guesses: new Set(), incorrect: new Set(), errors: 0, result: null }
  for (const guess of guesses) round = applyDailyGuess(round, guess)
  return round
}

export function applyDailyGuess(round: DailyRound, input: string): DailyRound {
  if (round.result) return round
  const guess = normalizeGuess(input, 'ca')
  if (!guess || round.guesses.has(guess)) return round
  const guesses = new Set(round.guesses).add(guess)
  if (isCorrectGuess(round.entry.answerCa, guess, 'ca')) {
    return { ...round, guesses, result: isWordComplete(round.entry.answerCa, guesses, 'ca') ? 'win' : null }
  }
  const incorrect = new Set(round.incorrect).add(guess)
  const errors = round.errors + 1
  return { ...round, guesses, incorrect, errors, result: errors >= DAILY_MAX_ERRORS ? 'loss' : null }
}
