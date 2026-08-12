import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { displayWord } from '../shared/game.ts'
import { LearningResultCard } from '../src/components/LearningResultCard.tsx'
import { applyLearningGuess, createLearningRound, entriesForDifficulty, selectNextEntry } from '../src/learning/game.ts'
import type { VocabularyEntry } from '../src/learning/types.ts'

const entry = (id: string, word: string, difficulty: VocabularyEntry['difficulty'] = 'easy'): VocabularyEntry => ({
  id, word, difficulty, translationEs: [`traducción-${id}`], exampleCa: `Una frase amb ${word}.`, corpusCount: 1,
  sources: { word: 'test', example: 'test' },
})

const entries = [entry('a', 'cançó'), entry('b', 'pingüí'), entry('c', 'col·legi', 'hard')]

assert.deepEqual(entriesForDifficulty(entries, 'easy').map(({ id }) => id), ['a', 'b'])
assert.equal(selectNextEntry(entries, 'easy', ['a'], () => 0).id, 'b')
assert.equal(selectNextEntry(entries, 'hard', [], () => 0).difficulty, 'hard')

let winning = createLearningRound(entry('win', 'cançó'))
for (const letter of ['c', 'a', 'n', 'ç', 'ó']) winning = applyLearningGuess(winning, letter)
assert.equal(winning.result, 'win')
assert.equal(displayWord(winning.entry.word, winning.guesses, 'ca').join(''), 'cançó')

let losing = createLearningRound(entry('loss', 'casa'))
for (const letter of ['b', 'd', 'f', 'g', 'h', 'j']) losing = applyLearningGuess(losing, letter)
assert.equal(losing.errors, 6)
assert.equal(losing.result, 'loss')
assert.deepEqual(losing.entry.translationEs, ['traducción-loss'])
assert.match(losing.entry.exampleCa, /casa/)
const resultMarkup = renderToStaticMarkup(createElement(LearningResultCard, {
  entry: losing.entry, result: 'loss', language: 'es', onNext: () => {}, onChangeDifficulty: () => {},
}))
assert.match(resultMarkup, />casa</)
assert.match(resultMarkup, /traducción-loss/)
assert.match(resultMarkup, /Una frase amb <strong>casa<\/strong>\./)

for (const [word, guesses] of [['cançó', ['c', 'a', 'n', 'ç', 'o']], ['pingüí', ['p', 'i', 'n', 'g', 'u']], ['col·legi', ['c', 'o', 'l', 'e', 'g', 'i']]] as const) {
  let round = createLearningRound(entry(word, word))
  for (const guess of guesses) round = applyLearningGuess(round, guess)
  assert.equal(round.result, 'win', `${word} should use accent-insensitive Catalan matching`)
}

console.log('learning mode tests passed')
