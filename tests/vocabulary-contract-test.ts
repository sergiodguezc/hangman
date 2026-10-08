import assert from 'node:assert/strict'
import reviewedMetadata from '../data/review/linguistic-metadata.json'
import { entriesForCefr, selectNextEntry } from '../src/learning/game'
import { createHash } from 'node:crypto'
import { DAILY_CHALLENGE_WORD_IDS, dailyWordPool } from '../src/daily/words.ts'
import { isLinguisticMetadata, isVocabularyEntry, vocabulary } from '../src/learning/vocabulary.ts'

const EXPECTED_VOCABULARY_COUNT = 544
const EXPECTED_ID_SET_SHA256 = '657f60c1607fd06dd081336abba3c19cc58be572e9cf504c98616ac80e3e708a'

assert.equal(vocabulary.length, EXPECTED_VOCABULARY_COUNT)

const ids = vocabulary.map((entry) => entry.id)
assert.equal(new Set(ids).size, ids.length)
assert.equal(createHash('sha256').update([...ids].sort().join('\n')).digest('hex'), EXPECTED_ID_SET_SHA256)
assert.ok(vocabulary.every(isVocabularyEntry))
assert.ok(vocabulary.every((entry) => entry.linguistics === undefined || isLinguisticMetadata(entry.linguistics)))

const vocabularyById = new Map(vocabulary.map((entry) => [entry.id, entry]))
assert.equal(dailyWordPool.length, DAILY_CHALLENGE_WORD_IDS.length)
for (const id of DAILY_CHALLENGE_WORD_IDS) {
  assert.ok(vocabularyById.has(id), `Daily challenge id ${id} should resolve`)
}

assert.ok(isLinguisticMetadata({
  cefr: 'A2',
  confidence: 0,
  thematicCategory: 'food-and-kitchen',
  partOfSpeech: 'noun',
  provenance: { source: 'review', version: '2026-08-26', method: 'manual-classification' },
}))
assert.ok(isLinguisticMetadata({ confidence: 1, provenance: { source: 'review' } }))
assert.equal(isLinguisticMetadata({ cefr: 'Z1' }), false)
assert.equal(isLinguisticMetadata({ confidence: -0.01 }), false)
assert.equal(isLinguisticMetadata({ confidence: 1.01 }), false)
assert.equal(isLinguisticMetadata({ thematicCategory: '' }), false)
assert.equal(isLinguisticMetadata({ partOfSpeech: 'article' }), false)
assert.equal(isLinguisticMetadata({ provenance: { source: '' } }), false)
assert.equal(isLinguisticMetadata({ provenance: { source: 'review', version: 1 } }), false)

console.log('vocabulary contract tests passed')

assert.deepEqual(Object.keys(reviewedMetadata).sort(), [...ids].sort())
for (const entry of vocabulary) {
  assert.ok(entry.linguistics?.cefr, `${entry.id} must have CEFR metadata`)
  assert.deepEqual(entry.linguistics, reviewedMetadata[entry.id as keyof typeof reviewedMetadata])
}
for (const level of ['basic', 'intermediate', 'advanced', 'all'] as const) {
  assert.ok(entriesForCefr(vocabulary, level).length > 0, `${level} must be playable in the real dataset`)
  assert.ok(selectNextEntry(vocabulary, level))
}
console.log('Production CEFR coverage and reviewed metadata parity passed')
