import assert from 'node:assert/strict'
import { getDailyChallenge, formatDailyShareData, formatDailyShareText, getDailyChallengeUrl } from '../src/daily/challenge'
import { createDailyRound, applyDailyGuess } from '../src/daily/game'
import { readDailyAttempt, writeDailyAttempt } from '../src/daily/storage'
import type { VocabularyEntry } from '../src/learning/types'
import { getHomeDailyStatus } from '../src/daily/homeSummary'

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
const shareUrlMatches = [...share.matchAll(/https:\/\/penjat\.cat\/paraula-del-dia/g)]
assert.match(share, /#37/)
assert.match(share, /Victòria/)
assert.match(share, /2 errors/)
assert.equal(shareUrlMatches.length, 1)
assert.doesNotMatch(share.toLocaleLowerCase('ca'), /aigua/)

const nativeShare = formatDailyShareData({
  language: 'ca',
  challengeNumber: 37,
  result: 'win',
  errors: 2,
  url: getDailyChallengeUrl('https://penjat.cat'),
})
assert.equal(nativeShare.text, share)
assert.equal('url' in nativeShare, false)

const challenge = getDailyChallenge(first, pool)
const summary = (value: unknown) => getHomeDailyStatus(challenge, { getItem: () => JSON.stringify(value) })
const fresh = { status: 'new', mistakes: 0 }
assert.deepEqual(getHomeDailyStatus(challenge, { getItem: () => null }), fresh)
assert.deepEqual(getHomeDailyStatus(challenge, { getItem: () => '{' }), fresh)
assert.deepEqual(getHomeDailyStatus(challenge, { getItem: () => { throw new Error('Storage unavailable') } }), fresh)
for (const invalid of [null, {}, [], { challengeId: challenge.id, guesses: 'AIGU' }, { challengeId: '2026-08-15', guesses: ['A', 'I', 'G', 'U'] }]) {
  assert.deepEqual(summary(invalid), fresh)
}
for (let mistakes = 0; mistakes <= 2; mistakes++) {
  const status = summary({ challengeId: challenge.id, guesses: [...['X', 'Z'].slice(0, mistakes), 'A', 'I', 'G', 'U'], completed: false, won: false, mistakes: 999 })
  assert.deepEqual(status, { status: 'won', mistakes })
  assert.deepEqual(Object.keys(status).sort(), ['mistakes', 'status'])
}
assert.deepEqual(summary({ challengeId: challenge.id, guesses: ['X', 'Z', 'B', 'C', 'D', 'E', 'A', 'I', 'G', 'U'], won: true }), { status: 'lost', mistakes: 6 })
assert.deepEqual(summary({ challengeId: challenge.id, guesses: ['A', 'A', 17, null, 'INVALID'], completed: true, won: true, mistakes: 0 }), fresh)
assert.deepEqual(summary({ challengeId: challenge.id, guesses: ['A', 'X'], completed: true, won: true }), { status: 'new', mistakes: 1 })

console.log('Daily challenge tests passed (including homepage replay and storage failures).')

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
