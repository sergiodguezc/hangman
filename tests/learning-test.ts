import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { displayWord } from '../shared/game.ts'
import { LearningSummary } from '../src/pages/LearningPage.tsx'
import { learningTranslations } from '../src/learning/i18n.ts'
import { LearningResultCard } from '../src/components/LearningResultCard.tsx'
import { allowedCefrLevelsForGroup, applyLearningGuess, createLearningRound, entriesForCefr, entriesForDifficulty, levelGroupFromStoredSelection, selectNextEntry, summarizeLearningHistory, practicedLearningLevels } from '../src/learning/game.ts'
import type { CefrLevel, SessionHistoryEntry, VocabularyEntry } from '../src/learning/types.ts'

const entry = (id: string, word: string, difficulty: VocabularyEntry['difficulty'] = 'easy', cefr: CefrLevel = 'A1'): VocabularyEntry => ({
  id, word, answerCa: word, type: 'word', definitionCa: `Definició de ${word}.`, translationEs: `traducción-${id}`,
  difficulty, hintEs: `traducción-${id}`, translationsEs: [`traducción-${id}`], exampleCa: `Una frase amb ${word}.`, corpusCount: 1,
  sources: { word: 'test', example: 'test' },
  linguistics: { cefr },
})

const entries = [entry('a', 'cançó', 'easy', 'A1'), entry('b', 'pingüí', 'easy', 'A2'), entry('c', 'col·legi', 'hard', 'B1'), entry('d', 'casa', 'medium', 'B2'), entry('e', 'món', 'medium', 'C1'), entry('f', 'univers', 'hard', 'C2')]

assert.deepEqual(entriesForDifficulty(entries, 'easy').map(({ id }) => id), ['a', 'b'])
assert.deepEqual(entriesForCefr(entries, 'A2').map(({ id }) => id), ['b'])
assert.equal(entriesForCefr(entries, 'all').length, 6)
assert.deepEqual(allowedCefrLevelsForGroup('basic'), ['A1', 'A2'])
assert.deepEqual(entriesForCefr(entries, 'basic').map(({ id }) => id), ['a', 'b'])
assert.deepEqual(entriesForCefr(entries, 'intermediate').map(({ id }) => id), ['c', 'd'])
assert.deepEqual(entriesForCefr(entries, 'advanced').map(({ id }) => id), ['e', 'f'])
assert.deepEqual(entriesForCefr(entries, 'all').map(({ id }) => id), ['a', 'b', 'c', 'd', 'e', 'f'])
assert.equal(levelGroupFromStoredSelection('A1'), 'basic')
assert.equal(levelGroupFromStoredSelection('A2'), 'basic')
assert.equal(levelGroupFromStoredSelection('B1'), 'intermediate')
assert.equal(levelGroupFromStoredSelection('B2'), 'intermediate')
assert.equal(levelGroupFromStoredSelection('C1'), 'advanced')
assert.equal(levelGroupFromStoredSelection('C2'), 'advanced')
assert.equal(levelGroupFromStoredSelection('all'), 'all')
assert.equal(selectNextEntry(entries, 'A1', [], () => 0).id, 'a')
assert.equal(selectNextEntry(entries, 'B1', [], () => 0).difficulty, 'hard')

const sessionHistory: SessionHistoryEntry[] = [
  { position: 1, wordId: 'a', result: 'correct' },
  { position: 2, wordId: 'b', result: 'failed' },
  { position: 3, wordId: 'a', result: 'failed' },
]
const stats = summarizeLearningHistory(sessionHistory)
assert.equal(stats.total, 3)
assert.equal(stats.correct, 1)
assert.equal(stats.failed, 2)
assert.equal(stats.accuracy, 33)
assert.equal(stats.uniqueWords, 2)
assert.deepEqual(selectNextEntry(entries, 'A1', sessionHistory, () => 0).id, 'a')
assert.equal(selectNextEntry(entries, 'A1', [{ position: 1, wordId: 'a', result: 'failed' }], () => 0).id, 'a')
assert.equal(stats.recoveredWords, 1)
const recovered = [...sessionHistory, { position: 4, wordId: 'b', result: 'failed' }, { position: 5, wordId: 'b', result: 'correct' }]
assert.equal(summarizeLearningHistory(recovered).recoveredWords, 2)

let winning = createLearningRound(entry('win', 'cançó'))
for (const letter of ['c', 'a', 'n', 'ç', 'ó']) winning = applyLearningGuess(winning, letter)
assert.equal(winning.result, 'win')
assert.equal(displayWord(winning.entry.word, winning.guesses, 'ca').join(''), 'cançó')

let losing = createLearningRound(entry('loss', 'casa'))
for (const letter of ['b', 'd', 'f', 'g', 'h', 'j']) losing = applyLearningGuess(losing, letter)
assert.equal(losing.errors, 6)
assert.equal(losing.result, 'loss')
assert.equal(losing.entry.hintEs, 'traducción-loss')
assert.match(losing.entry.exampleCa, /casa/)
const resultMarkup = renderToStaticMarkup(createElement(LearningResultCard, {
  entry: losing.entry, result: 'loss', language: 'es', onNext: () => {}, onChangeDifficulty: () => {},
}))
assert.match(resultMarkup, />casa</)
assert.match(resultMarkup, /traducción-loss/)
assert.match(resultMarkup, /Una frase amb <strong>casa<\/strong>\./)

const phrase = { ...entry('mica', 'mica'), answerCa: 'una mica', type: 'expression' as const, targetExpression: 'una mica', translationEs: 'un poco', hintEs: 'un poco', translationsEs: ['un poco'], exampleCa: 'Estic una mica cansat.' }
let phraseRound = createLearningRound(phrase)
for (const letter of ['u', 'n', 'a', 'm', 'i', 'c']) phraseRound = applyLearningGuess(phraseRound, letter)
assert.equal(phraseRound.result, 'win')
assert.equal(displayWord(phrase.answerCa, new Set(), 'ca').join(''), '___ ____')
const phraseMarkup = renderToStaticMarkup(createElement(LearningResultCard, {
  entry: phrase, result: 'win', language: 'es', onNext: () => {}, onChangeDifficulty: () => {},
}))
assert.match(phraseMarkup, />una mica</)
assert.match(phraseMarkup, /<strong>una mica<\/strong>/)

for (const [word, guesses] of [['cançó', ['c', 'a', 'n', 'ç', 'o']], ['pingüí', ['p', 'i', 'n', 'g', 'u']], ['col·legi', ['c', 'o', 'l', 'e', 'g', 'i']]] as const) {
  let round = createLearningRound(entry(word, word))
  for (const guess of guesses) round = applyLearningGuess(round, guess)
  assert.equal(round.result, 'win', `${word} should use accent-insensitive Catalan matching`)
}

console.log('learning mode tests passed')

for (const level of ['basic', 'intermediate', 'advanced', 'all'] as const) {
  assert.ok(selectNextEntry(entries, level))
  assert.equal(selectNextEntry([], level), null)
}
assert.equal(selectNextEntry(entries.slice(0, 2), 'advanced'), null)
assert.equal(levelGroupFromStoredSelection('corrupt-preference'), 'all')
const mixedHistory: SessionHistoryEntry[] = [
  { position: 1, wordId: 'a', result: 'correct', cefr: 'A1' },
  { position: 2, wordId: 'c', result: 'failed', cefr: 'B1' },
]
assert.deepEqual(practicedLearningLevels(mixedHistory), ['basic', 'intermediate'])
assert.deepEqual(practicedLearningLevels([]), [])
const advanced = selectNextEntry(entries, 'advanced', mixedHistory)
assert.ok(advanced)
assert.equal(levelGroupFromStoredSelection(advanced.linguistics?.cefr), 'advanced')
// Selecting/starting a word does not add it to completed practice history.
assert.deepEqual(practicedLearningLevels(mixedHistory), ['basic', 'intermediate'])
for (const language of ['ca', 'es'] as const) {
  const t = learningTranslations[language]
  const summary = renderToStaticMarkup(createElement(LearningSummary, { history: mixedHistory, expanded: false, language, onToggleExpanded: () => {} }))
  assert.ok(summary.includes(t.practicedLevels))
  assert.ok(summary.includes(`${t.levelGroups.basic} · ${t.levelGroups.intermediate}`))
  assert.ok(!summary.includes(t.levelGroups.advanced))
  assert.ok(summary.includes(t.failedAttempts))
  assert.ok(summary.includes('50%'))
  assert.ok(!t.statsLine(2, 1, 1, 50, 2).includes('errors'))
  assert.ok(!t.statsLine(2, 1, 1, 50, 2).includes('errores'))
}
let imperfectWin = createLearningRound(entry('imperfect', 'casa'))
for (const guess of ['Z', 'X', 'C', 'A', 'S']) imperfectWin = applyLearningGuess(imperfectWin, guess)
assert.equal(imperfectWin.result, 'win')
assert.equal(imperfectWin.errors, 2)
const wordStats = summarizeLearningHistory([{ position: 1, wordId: 'imperfect', result: 'correct' }, { position: 2, wordId: 'loss', result: 'failed' }])
assert.equal(wordStats.correct, 1)
assert.equal(wordStats.failed, 1)
assert.equal(wordStats.accuracy, 50)
console.log('Learning empty selection, mixed levels and word/letter statistics regressions passed')
