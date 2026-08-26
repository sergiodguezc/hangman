import { isCorrectGuess, isWordComplete, normalizeGuess } from '../../shared/game'
import type { LearningAttemptResult, LearningCefrSelection, LearningRound, LearningSessionStats, SessionHistoryEntry, VocabularyDifficulty, VocabularyEntry, WordSessionStats } from './types'

export const MAX_LEARNING_ERRORS = 6
export const RECENT_WORD_LIMIT = 8

export function entriesForDifficulty(entries: readonly VocabularyEntry[], difficulty: VocabularyDifficulty) {
  return entries.filter((entry) => entry.difficulty === difficulty)
}

export function entriesForCefr(entries: readonly VocabularyEntry[], level: LearningCefrSelection) {
  return level === 'all' ? [...entries] : entries.filter((entry) => entry.linguistics?.cefr === level)
}

export function selectNextEntry(
  entries: readonly VocabularyEntry[],
  level: LearningCefrSelection,
  history: readonly SessionHistoryEntry[] = [],
  random: () => number = Math.random,
): VocabularyEntry {
  const matching = entriesForCefr(entries, level)
  if (!matching.length) throw new Error(`No vocabulary entries found for CEFR level “${level}”.`)
  const stats = summarizeLearningHistory(history).byWord
  const unseen = matching.filter((entry) => !stats.has(entry.id))
  const reviewable = matching.filter((entry) => {
    const word = stats.get(entry.id)
    return word && word.failed > 0 && history.length - word.lastSeenAt >= 4
  })
  const cooledDown = matching.filter((entry) => !stats.get(entry.id) || history.length - (stats.get(entry.id)?.lastSeenAt ?? 0) >= 4)
  const pool = unseen.length
    ? [...unseen, ...reviewable.filter((entry) => !unseen.includes(entry))]
    : (reviewable.length ? reviewable : (cooledDown.length ? cooledDown : matching))
  const weighted = pool.map((entry) => ({ entry, weight: learningEntryWeight(stats.get(entry.id), history.length, unseen.length > 0) }))
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0)
  let threshold = random() * totalWeight
  for (const item of weighted) {
    threshold -= item.weight
    if (threshold <= 0) return item.entry
  }
  return weighted.at(-1)?.entry ?? matching[0]
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

export function learningResultToAttemptResult(result: LearningRound['result']): LearningAttemptResult {
  return result === 'win' ? 'correct' : 'failed'
}

export function summarizeLearningHistory(history: readonly SessionHistoryEntry[]): LearningSessionStats {
  const byWord = new Map<string, WordSessionStats>()
  let correct = 0
  let failed = 0
  for (const entry of history) {
    const current = byWord.get(entry.wordId) ?? { appearances: 0, correct: 0, failed: 0, lastSeenAt: 0 }
    current.appearances += 1
    current.lastSeenAt = entry.position
    if (entry.result === 'correct') { current.correct += 1; correct += 1 }
    else { current.failed += 1; failed += 1 }
    byWord.set(entry.wordId, current)
  }
  const total = history.length
  const recoveredWords = [...byWord.values()].filter((word) => word.failed > 0 && word.correct > 0).length
  return { total, correct, failed, accuracy: total ? Math.round((correct / total) * 100) : 0, uniqueWords: byWord.size, recoveredWords, byWord }
}
function learningEntryWeight(stats: WordSessionStats | undefined, completedAttempts: number, unseenRemain: boolean): number {
  if (!stats) return 10
  if (unseenRemain && stats.correct > 0 && stats.failed === 0) return 0.05
  const age = completedAttempts - stats.lastSeenAt + 1
  const failureBonus = stats.failed > 0 ? Math.min(7, 2 + stats.failed * 1.5) : 1
  const successPenalty = stats.correct > 0 ? 0.35 : 1
  const appearancesPenalty = 1 / Math.sqrt(stats.appearances)
  return Math.max(0.01, failureBonus * successPenalty * appearancesPenalty * recencyWeight(age))
}

function recencyWeight(age: number): number {
  if (age <= 2) return 0.05
  if (age <= 4) return 0.2
  if (age <= 7) return 0.6
  return 1
}
