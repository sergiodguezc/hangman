import { ALPHABETS } from '../../shared/game'
import type { LearningResult, LearningUnit } from './types'

export const LEARNING_STORAGE_KEY = 'penjat-learning'

/** Result of the most recent finished attempt. A word is discovered once it has one. */
export type WordResult = 'correct' | 'failed'
/** The finished word whose card has not been dismissed yet: a refresh shows it again without recording it twice. */
export type PendingCard = { result: LearningResult; errors: number }
export type UnitSession = { kind: 'unit' | 'review'; queue: string[]; index: number; guesses: string[]; pending: PendingCard | null }
export type LearningProgress = { words: Record<string, WordResult>; bookmarks: string[]; sessions: Record<string, UnitSession> }
export type UnitStats = { total: number; discovered: number; correct: number; failed: number; percent: number }

export const emptyProgress = (): LearningProgress => ({ words: {}, bookmarks: [], sessions: {} })

/** Never throws: corrupt or foreign data starts empty, and IDs no longer in the dataset are dropped. */
export function readLearning(storage: Pick<Storage, 'getItem'> | null, units: readonly LearningUnit[]): LearningProgress {
  const progress = emptyProgress()
  let raw: { version?: unknown; words?: unknown; bookmarks?: unknown; sessions?: unknown }
  try { raw = JSON.parse(storage?.getItem(LEARNING_STORAGE_KEY) ?? 'null') } catch { return progress }
  if (raw?.version !== 1) return progress
  const known = new Set(units.flatMap((unit) => unit.words.map((word) => word.id)))
  const words = raw.words && typeof raw.words === 'object' ? raw.words as Record<string, unknown> : {}
  for (const [id, result] of Object.entries(words)) if (known.has(id) && (result === 'correct' || result === 'failed')) progress.words[id] = result
  if (Array.isArray(raw.bookmarks)) progress.bookmarks = [...new Set(raw.bookmarks.filter((id) => known.has(id)))]
  const sessions = raw.sessions && typeof raw.sessions === 'object' ? raw.sessions as Record<string, Partial<UnitSession>> : {}
  for (const unit of units) {
    const session = readSession(sessions[unit.id], new Set(unit.words.map((word) => word.id)))
    if (session) progress.sessions[unit.id] = session
  }
  return progress
}

function readSession(raw: Partial<UnitSession> | undefined, unitWords: Set<string>): UnitSession | null {
  if (!raw || (raw.kind !== 'unit' && raw.kind !== 'review') || !Array.isArray(raw.queue) || !Number.isInteger(raw.index)) return null
  // Removed words leave the queue; the position stays on the same word, or moves to the next one if it was removed.
  const current = raw.queue[raw.index!]
  const queue = [...new Set(raw.queue.filter((id) => unitWords.has(id)))]
  const index = raw.queue.slice(0, raw.index).filter((id) => unitWords.has(id)).length
  if (index < 0 || index >= queue.length) return null
  const kept = queue[index] === current
  const pending = raw.pending
  const validPending = kept && pending && (pending.result === 'win' || pending.result === 'loss') && Number.isInteger(pending.errors) && pending.errors >= 0 && pending.errors <= 6
  const guesses = kept && Array.isArray(raw.guesses) ? [...new Set(raw.guesses.filter((guess) => ALPHABETS.ca.includes(guess)))] : []
  return { kind: raw.kind, queue, index, guesses: validPending ? [] : guesses, pending: validPending ? { result: pending.result, errors: pending.errors } : null }
}

export function writeLearning(storage: Pick<Storage, 'setItem'> | null, progress: LearningProgress): void {
  try { storage?.setItem(LEARNING_STORAGE_KEY, JSON.stringify({ version: 1, ...progress })) } catch { /* play continues without saving */ }
}

export function unitStats(progress: LearningProgress, unit: LearningUnit): UnitStats {
  const results = unit.words.map((word) => progress.words[word.id])
  const discovered = results.filter(Boolean).length
  return { total: unit.words.length, discovered, correct: results.filter((result) => result === 'correct').length, failed: results.filter((result) => result === 'failed').length, percent: Math.round((discovered / unit.words.length) * 100) }
}

export const currentWordId = (session: UnitSession) => session.queue[session.index]
const withSession = (progress: LearningProgress, unitId: string, session: UnitSession | null): LearningProgress => {
  const sessions = { ...progress.sessions }
  if (session) sessions[unitId] = session
  else delete sessions[unitId]
  return { ...progress, sessions }
}
const newSession = (progress: LearningProgress, unit: LearningUnit, kind: UnitSession['kind'], queue: string[]) =>
  queue.length ? withSession(progress, unit.id, { kind, queue, index: 0, guesses: [], pending: null }) : progress

/** Comença / Continua: resume the unit's session, or queue the words not discovered yet, in unit order. */
export function startSession(progress: LearningProgress, unit: LearningUnit): LearningProgress {
  if (progress.sessions[unit.id]) return progress
  return newSession(progress, unit, 'unit', unit.words.filter((word) => !progress.words[word.id]).map((word) => word.id))
}
/** Torna a jugar la unitat: all words again. Lifetime results are only overwritten as each word is finished. */
export const replaySession = (progress: LearningProgress, unit: LearningUnit) => newSession(progress, unit, 'unit', unit.words.map((word) => word.id))
/** Repassa les fallades: the words whose latest attempt failed. */
export const reviewSession = (progress: LearningProgress, unit: LearningUnit) =>
  newSession(progress, unit, 'review', unit.words.filter((word) => progress.words[word.id] === 'failed').map((word) => word.id))

export function saveGuesses(progress: LearningProgress, unitId: string, guesses: string[]): LearningProgress {
  const session = progress.sessions[unitId]
  return session && !session.pending ? withSession(progress, unitId, { ...session, guesses }) : progress
}

/** Records the attempt and opens its card in one write. A second call for the same card changes nothing. */
export function recordFinish(progress: LearningProgress, unitId: string, card: PendingCard): LearningProgress {
  const session = progress.sessions[unitId]
  if (!session || session.pending) return progress
  const words = { ...progress.words, [currentWordId(session)]: card.result === 'win' ? 'correct' as const : 'failed' as const }
  return withSession({ ...progress, words }, unitId, { ...session, guesses: [], pending: card })
}

/** Següent paraula: closes the card and moves on; after the last word the session ends (the summary follows). */
export function acknowledge(progress: LearningProgress, unitId: string): LearningProgress {
  const session = progress.sessions[unitId]
  if (!session?.pending) return progress
  const index = session.index + 1
  return withSession(progress, unitId, index < session.queue.length ? { ...session, index, guesses: [], pending: null } : null)
}

export function toggleBookmark(progress: LearningProgress, wordId: string): LearningProgress {
  const bookmarks = progress.bookmarks.includes(wordId) ? progress.bookmarks.filter((id) => id !== wordId) : [...progress.bookmarks, wordId]
  return { ...progress, bookmarks }
}
