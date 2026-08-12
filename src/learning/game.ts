import { isCorrectGuess, isWordComplete, normalizeGuess } from '../../shared/game'
import type { LearningRound, VocabularyDifficulty, VocabularyEntry } from './types'

export const MAX_LEARNING_ERRORS = 6
export const RECENT_WORD_LIMIT = 8

export function entriesForDifficulty(entries: readonly VocabularyEntry[], difficulty: VocabularyDifficulty) {
  return entries.filter((entry) => entry.difficulty === difficulty)
}

export function selectNextEntry(
  entries: readonly VocabularyEntry[],
  difficulty: VocabularyDifficulty,
  recentIds: readonly string[] = [],
  random: () => number = Math.random,
): VocabularyEntry {
  const matching = entriesForDifficulty(entries, difficulty)
  if (!matching.length) throw new Error(`No vocabulary entries found for difficulty “${difficulty}”.`)
  const unseen = matching.filter((entry) => !recentIds.includes(entry.id))
  const withoutCurrent = matching.filter((entry) => entry.id !== recentIds.at(-1))
  const pool = unseen.length ? unseen : withoutCurrent.length ? withoutCurrent : matching
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

export function createLearningRound(entry: VocabularyEntry): LearningRound {
  return { entry, guesses: new Set(), incorrect: new Set(), errors: 0, result: null }
}

export function applyLearningGuess(round: LearningRound, input: string): LearningRound {
  if (round.result) return round
  const guess = normalizeGuess(input, 'ca')
  if (!guess || round.guesses.has(guess)) return round
  const guesses = new Set(round.guesses).add(guess)
  if (isCorrectGuess(round.entry.answerCa, guess, 'ca')) {
    return { ...round, guesses, result: isWordComplete(round.entry.answerCa, guesses, 'ca') ? 'win' : null }
  }
  const incorrect = new Set(round.incorrect).add(guess)
  const errors = round.errors + 1
  return { ...round, guesses, incorrect, errors, result: errors >= MAX_LEARNING_ERRORS ? 'loss' : null }
}

export function appendRecentId(recentIds: readonly string[], id: string): string[] {
  return [...recentIds.filter((recentId) => recentId !== id), id].slice(-RECENT_WORD_LIMIT)
}
