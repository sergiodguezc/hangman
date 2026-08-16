import assert from 'node:assert/strict'
import { getDailyChallenge, formatDailyShareText, getDailyChallengeUrl } from '../src/daily/challenge'
import { createDailyRound, applyDailyGuess } from '../src/daily/game'
import { readDailyAttempt, writeDailyAttempt } from '../src/daily/storage'
import type { VocabularyEntry } from '../src/learning/types'

const pool = [
  entry('aigua', 'aigua'),
  entry('arbre', 'arbre'),
  entry('cadira', 'cadira'),
] satisfies VocabularyEntry[]

const first = new Date('2026-08-16T10:00:00Z')
const firstLater = new Date('2026-08-16T21:30:00Z')
const second = new Date('2026-08-16T22:30:00Z')

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  private data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

assert.equal(getDailyChallenge(first, pool).id, getDailyChallenge(firstLater, pool).id)
assert.equal(getDailyChallenge(first, pool).entry.id, getDailyChallenge(firstLater, pool).entry.id)
assert.equal(getDailyChallenge(first, pool).number, 1)
assert.equal(getDailyChallenge(second, pool).number, 2)
assert.equal(getDailyChallenge(second, pool).entry.id, 'arbre')

const beforeSpringDst = getDailyChallenge(new Date('2027-03-27T23:30:00Z'), pool)
const afterSpringDst = getDailyChallenge(new Date('2027-03-28T22:30:00Z'), pool)
assert.equal(afterSpringDst.number, beforeSpringDst.number + 1)

const beforeAutumnDst = getDailyChallenge(new Date('2027-10-30T22:30:00Z'), pool)
const afterAutumnDst = getDailyChallenge(new Date('2027-10-31T23:30:00Z'), pool)
assert.equal(afterAutumnDst.number, beforeAutumnDst.number + 1)

const storage = new MemoryStorage()
let round = createDailyRound(pool[0])
round = applyDailyGuess(round, 'A')
round = applyDailyGuess(round, 'X')
writeDailyAttempt(storage, {
  challengeId: '2026-08-16',
  guesses: [...round.guesses],
  completed: false,
  won: null,
  mistakes: round.errors,
})
assert.deepEqual(readDailyAttempt(storage, '2026-08-16')?.guesses, ['A', 'X'])
assert.equal(readDailyAttempt(storage, '2026-08-17'), null)

let finished = round
for (const letter of ['I', 'G', 'U']) finished = applyDailyGuess(finished, letter)
writeDailyAttempt(storage, {
  challengeId: '2026-08-16',
  guesses: [...finished.guesses],
  completed: finished.result !== null,
  won: finished.result === 'win',
  mistakes: finished.errors,
})
const restored = readDailyAttempt(storage, '2026-08-16')
assert.equal(restored?.completed, true)
assert.equal(restored?.won, true)
assert.equal(restored?.mistakes, 1)

const share = formatDailyShareText({
  language: 'ca',
  challengeNumber: 37,
  result: 'win',
  errors: 2,
  url: getDailyChallengeUrl('https://penjat.cat'),
})
assert.match(share, /#37/)
assert.match(share, /Victòria/)
assert.match(share, /2 errors/)
assert.match(share, /https:\/\/penjat\.cat\/paraula-del-dia/)
assert.doesNotMatch(share.toLocaleLowerCase('ca'), /aigua/)

console.log('Daily challenge tests passed.')

function entry(id: string, answerCa: string): VocabularyEntry {
  return {
    id,
    word: answerCa,
    answerCa,
    type: 'word',
    definitionCa: `Definició de ${answerCa}`,
    translationEs: answerCa,
    hintEs: answerCa,
    exampleCa: answerCa,
    difficulty: 'easy',
    corpusCount: 1,
    sources: { word: 'test', example: 'test' },
  }
}
