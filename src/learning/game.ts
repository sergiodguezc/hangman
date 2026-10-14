import { isCorrectGuess, isWordComplete, normalizeGuess } from '../../shared/game'
import type { LearningRound } from './types'

export const MAX_LEARNING_ERRORS = 6

/** A round of `answer`, optionally rebuilt from stored guesses (same replay as the daily challenge). */
export function createLearningRound(answer: string, guesses: Iterable<string> = []): LearningRound {
  let round: LearningRound = { answer, guesses: new Set(), incorrect: new Set(), errors: 0, result: null }
  for (const guess of guesses) round = applyLearningGuess(round, guess)
  return round
}

export function applyLearningGuess(round: LearningRound, input: string): LearningRound {
  if (round.result) return round
  const guess = normalizeGuess(input, 'ca')
  if (!guess || round.guesses.has(guess)) return round
  const guesses = new Set(round.guesses).add(guess)
  if (isCorrectGuess(round.answer, guess, 'ca')) {
    return { ...round, guesses, result: isWordComplete(round.answer, guesses, 'ca') ? 'win' : null }
  }
  const incorrect = new Set(round.incorrect).add(guess)
  const errors = round.errors + 1
  return { ...round, guesses, incorrect, errors, result: errors >= MAX_LEARNING_ERRORS ? 'loss' : null }
}
