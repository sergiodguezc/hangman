import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { displayWord } from '../shared/game.ts'
import { HangmanWord } from '../src/components/HangmanWord.tsx'
import { VocabularyCard } from '../src/components/VocabularyCard.tsx'
import { applyLearningGuess, createLearningRound } from '../src/learning/game.ts'
import { learningTranslations } from '../src/learning/i18n.ts'
import { LEARNING_STORAGE_KEY, acknowledge, currentWordId, emptyProgress, readLearning, recordFinish, replaySession, reviewSession, saveGuesses, startSession, toggleBookmark, unitStats, writeLearning } from '../src/learning/progress.ts'
import type { LearningProgress } from '../src/learning/progress.ts'
import type { LearningUnit, UnitWord } from '../src/learning/types.ts'
import { allLearningUnits, learningUnits, validateUnits, visibleUnits } from '../src/learning/units.ts'
import { LearningPage, UnitSummary } from '../src/pages/LearningPage.tsx'

// Round rules (shared with the old mode): accent-insensitive Catalan guesses, six errors, replay from stored guesses.
for (const [word, guesses] of [['cançó', ['c', 'a', 'n', 'ç', 'o']], ['pingüí', ['p', 'i', 'n', 'g', 'u']], ['col·legi', ['c', 'o', 'l', 'e', 'g', 'i']], ['núvol', ['N', 'U', 'V', 'O', 'L']]] as const) {
  let round = createLearningRound(word)
  for (const guess of guesses) round = applyLearningGuess(round, guess)
  assert.equal(round.result, 'win', `${word} should use accent-insensitive Catalan matching`)
}
let losing = createLearningRound('casa')
for (const letter of ['b', 'd', 'f', 'g', 'h', 'j', 'k']) losing = applyLearningGuess(losing, letter)
assert.equal(losing.errors, 6)
assert.equal(losing.result, 'loss')
assert.equal(losing.guesses.size, 6, 'no guesses after the round ends')
const replayed = createLearningRound('casa', ['Z', 'A', 'X', 'A'])
assert.deepEqual([replayed.errors, [...replayed.guesses], replayed.result], [2, ['Z', 'A', 'X'], null])
assert.equal(displayWord('una mica', new Set(), 'ca').join(''), '___ ____')
const wordMarkup = renderToStaticMarkup(createElement(HangmanWord, { word: "d'altra banda", guesses: new Set(['A']), language: 'ca', reveal: false, label: 'Progrés de la paraula catalana' }))
assert.match(wordMarkup, /^<div class="word" role="group" aria-label="Progrés de la paraula catalana" style="--letters:13">/)
console.log('Learning round rules passed')

// Dataset: the real file validates, every illustration and unit emblem exists, and only reviewed units reach production.
const word = (id: string, extra: Partial<UnitWord> = {}): UnitWord => ({ id, word: id, translationEs: `es-${id}`, definitionCa: `Definició de ${id}.`, exampleCa: `Una frase amb ${id}.`, ...extra })
const letters = 'abcdefghijkl'.split('')
const unit = (id: string, status: LearningUnit['status'] = 'ready', words = letters.map((letter) => word(`${id}${letter}`))): LearningUnit => ({ id, titleCa: `Unitat ${id}`, titleEs: `Unidad ${id}`, status, words })
assert.ok(allLearningUnits.length >= 1)
for (const item of allLearningUnits) {
  assert.ok(existsSync(`public/learning/units/${item.id}.svg`), `${item.id} needs a unit emblem`)
  for (const entry of item.words) if (entry.illustration) assert.ok(existsSync(`public/learning/words/${entry.illustration}.svg`), `${entry.id} illustration exists`)
}
assert.deepEqual(learningUnits, allLearningUnits.filter((item) => item.status === 'ready'), 'tests run as production: drafts are hidden')
assert.deepEqual(visibleUnits([unit('x', 'draft'), unit('y')], false).map(({ id }) => id), ['y'])
assert.deepEqual(visibleUnits([unit('x', 'draft'), unit('y')], true).map(({ id }) => id), ['x', 'y'])
const dataset = (units: unknown[]) => ({ version: 1, units })
assert.doesNotThrow(() => validateUnits(dataset([unit('x')])))
assert.throws(() => validateUnits(dataset([unit('x', 'ready', unit('x').words.slice(1))])), /exactly 12/)
assert.throws(() => validateUnits(dataset([unit('x'), unit('x')])), /Duplicate/)
assert.throws(() => validateUnits(dataset([unit('x'), { ...unit('y'), words: unit('x').words }])), /Duplicate learning ID xa/)
assert.throws(() => validateUnits(dataset([unit('x', 'ready', [word('xa', { exampleCa: 'Sense la paraula.' }), ...unit('x').words.slice(1)])])), /example/)
assert.doesNotThrow(() => validateUnits(dataset([unit('x', 'ready', [word('xa', { exampleCa: 'Unes xas.', exampleForm: 'xas' }), ...unit('x').words.slice(1)])])))
assert.throws(() => validateUnits(dataset([unit('x', 'ready', [word('xa', { word: 'x2' }), ...unit('x').words.slice(1)])])), /keyboard/)
assert.throws(() => validateUnits(dataset([unit('x', 'ready', [word('xa', { illustration: '../x' }), ...unit('x').words.slice(1)])])), /illustration/)
assert.throws(() => validateUnits(dataset([unit('x', 'ready', [word('xa', { note: '' }), ...unit('x').words.slice(1)])])), /optional/)
assert.throws(() => validateUnits(dataset([{ ...unit('x'), status: 'published' }])), /Invalid learning unit/)
assert.throws(() => validateUnits({ version: 2, units: [] }), /version: 1/)
console.log('Learning dataset validation passed')

// Sessions and lifetime progress.
const nature = unit('n')
const ids = nature.words.map(({ id }) => id)
const memory = () => { const items = new Map<string, string>(); return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value) }, items } }
const finish = (progress: LearningProgress, result: 'win' | 'loss') => recordFinish(progress, 'n', { result, errors: result === 'win' ? 1 : 6 })
const next = (progress: LearningProgress) => acknowledge(progress, 'n')

let progress = startSession(emptyProgress(), nature)
assert.deepEqual(progress.sessions.n, { kind: 'unit', queue: ids, index: 0, guesses: [], pending: null })
assert.equal(startSession(progress, nature), progress, 'Continua resumes the same session')
progress = saveGuesses(progress, 'n', ['A', 'E'])
// Finishing records the attempt and opens the card in one state; a repeated finish (refresh, double event) is ignored.
progress = finish(progress, 'win')
assert.deepEqual(progress.sessions.n.pending, { result: 'win', errors: 1 })
assert.deepEqual(progress.sessions.n.guesses, [])
assert.equal(finish(progress, 'loss'), progress, 'a pending card is never recorded twice')
const storage = memory()
writeLearning(storage, progress)
const restored = readLearning(storage, [nature])
assert.deepEqual(restored, progress, 'a refresh shows the same pending card')
assert.deepEqual(unitStats(restored, nature), { total: 12, discovered: 1, correct: 1, failed: 0, percent: 8 })
progress = next(progress)
assert.equal(currentWordId(progress.sessions.n), 'nb')
assert.equal(next(progress), progress, 'acknowledge needs a pending card')
progress = finish(progress, 'loss')
progress = next(progress)
// Leaving mid-word keeps the guesses (they are saved after every letter).
progress = saveGuesses(progress, 'n', ['S'])
writeLearning(storage, progress)
assert.deepEqual(readLearning(storage, [nature]).sessions.n.guesses, ['S'])
assert.deepEqual(unitStats(progress, nature), { total: 12, discovered: 2, correct: 1, failed: 1, percent: 17 })
// Play the rest of the unit: the queue ends, the session is deleted (summary) and every word is discovered.
for (let index = 2; index < 12; index++) progress = next(finish(progress, index % 3 === 0 ? 'loss' : 'win'))
assert.equal(progress.sessions.n, undefined)
const done = unitStats(progress, nature)
assert.equal(done.discovered, 12)
assert.equal(done.correct + done.failed, 12, 'every discovered word is either correct or to practise')
assert.equal(done.percent, 100)
assert.equal(startSession(progress, nature), progress, 'a complete unit has nothing new to start')
// Review plays only the failed words; a win moves the word to correct, a loss keeps it to practise.
const failed = ids.filter((id) => progress.words[id] === 'failed')
progress = reviewSession(progress, nature)
assert.deepEqual(progress.sessions.n, { kind: 'review', queue: failed, index: 0, guesses: [], pending: null })
progress = next(finish(progress, 'win'))
progress = next(finish(progress, 'loss'))
assert.equal(progress.words[failed[0]], 'correct')
assert.equal(progress.words[failed[1]], 'failed')
assert.equal(unitStats(progress, nature).discovered, 12, 'review never changes completion')
// Replay queues all 12 words without resetting lifetime results.
const before = progress.words
progress = replaySession(progress, nature)
assert.deepEqual(progress.sessions.n.queue, ids)
assert.equal(progress.words, before)
assert.equal(reviewSession({ ...emptyProgress(), words: { na: 'correct' } }, nature).sessions.n, undefined, 'no review without failed words')
// Bookmarks are independent of results.
progress = toggleBookmark(toggleBookmark(progress, 'nc'), 'nd')
assert.deepEqual(progress.bookmarks, ['nc', 'nd'])
assert.deepEqual(toggleBookmark(progress, 'nc').bookmarks, ['nd'])
console.log('Learning sessions, statistics and bookmarks passed')

// Storage: corrupt, old and foreign data never throw; dataset changes are absorbed.
for (const raw of ['{', 'null', '[]', '{"version":2,"words":{"na":"correct"}}', '{"version":1,"words":"x","bookmarks":{},"sessions":[]}']) {
  const broken = memory(); broken.setItem(LEARNING_STORAGE_KEY, raw)
  assert.deepEqual(readLearning(broken, [nature]), emptyProgress(), raw)
}
assert.deepEqual(readLearning(null, [nature]), emptyProgress())
assert.doesNotThrow(() => writeLearning({ setItem: () => { throw new Error('quota') } }, progress))
const legacy = memory(); legacy.setItem('penjat-learning-cefr', 'basic')
assert.deepEqual(readLearning(legacy, [nature]), emptyProgress(), 'the old CEFR preference is ignored')
const stored = memory()
stored.setItem(LEARNING_STORAGE_KEY, JSON.stringify({ version: 1, words: { na: 'correct', gone: 'failed', nb: 'maybe' }, bookmarks: ['nb', 'gone', 'nb'],
  sessions: { n: { kind: 'unit', queue: ['na', 'gone', 'nc', 'nd'], index: 2, guesses: ['A', 'é', 'A', 7], pending: null }, removed: { kind: 'unit', queue: ['x'], index: 0, guesses: [], pending: null } } }))
const cleaned = readLearning(stored, [nature])
assert.deepEqual(cleaned.words, { na: 'correct' })
assert.deepEqual(cleaned.bookmarks, ['nb'])
assert.deepEqual(cleaned.sessions, { n: { kind: 'unit', queue: ['na', 'nc', 'nd'], index: 1, guesses: ['A'], pending: null } }, 'a removed word leaves the queue and the position stays on nc')
// The current word was removed: move on to the next one with a fresh round and no stale card.
stored.setItem(LEARNING_STORAGE_KEY, JSON.stringify({ version: 1, words: {}, bookmarks: [], sessions: { n: { kind: 'unit', queue: ['na', 'gone', 'nc'], index: 1, guesses: ['A'], pending: { result: 'win', errors: 0 } } } }))
assert.deepEqual(readLearning(stored, [nature]).sessions.n, { kind: 'unit', queue: ['na', 'nc'], index: 1, guesses: [], pending: null })
stored.setItem(LEARNING_STORAGE_KEY, JSON.stringify({ version: 1, words: {}, bookmarks: [], sessions: { n: { kind: 'unit', queue: ['na', 'gone'], index: 1, guesses: [], pending: null } } }))
assert.equal(readLearning(stored, [nature]).sessions.n, undefined, 'a session with nothing left is dropped')
stored.setItem(LEARNING_STORAGE_KEY, JSON.stringify({ version: 1, words: {}, bookmarks: [], sessions: { n: { kind: 'unit', queue: ['na'], index: 0, guesses: [], pending: { result: 'win', errors: 99 } } } }))
assert.equal(readLearning(stored, [nature]).sessions.n.pending, null)
// A word added to a finished unit shows as new, so the unit continues at 92%.
const grown = { ...nature, words: [...nature.words.slice(0, 11), word('nz')] }
assert.deepEqual(unitStats({ ...emptyProgress(), words: Object.fromEntries(ids.map((id) => [id, 'correct' as const])) }, grown).percent, 92)
assert.deepEqual(startSession({ ...emptyProgress(), words: Object.fromEntries(ids.map((id) => [id, 'correct' as const])) }, grown).sessions.n.queue, ['nz'])
console.log('Learning storage tolerance passed')

// Vocabulary card: optional fields are hidden when absent; the illustration falls back to the unit emblem and initial.
const minimal = word('pa')
const full = allLearningUnits[0].words.find((entry) => entry.expression && entry.note && entry.illustration)!
for (const language of ['ca', 'es'] as const) {
  const t = learningTranslations[language]
  const bare = renderToStaticMarkup(createElement(VocabularyCard, { word: minimal, unit: nature, language, headingId: 'w' }))
  assert.match(bare, /<header class="vocab-band">.*<h2 lang="ca" id="w" tabindex="-1" style="--chars:2">pa<\/h2>/)
  for (const absent of [t.expression, t.note, 'vocab-ipa', 'vocab-grammar', 'vocab-outcome', 'vocab-example-es', 'vocab-meta', 'vocab-listen']) assert.ok(!bare.includes(absent), `${absent} hidden`)
  assert.match(bare, /class="vocab-art vocab-art--fallback" aria-hidden="true"><img src="\/learning\/units\/n.svg" alt=""[^>]*\/><span lang="ca">p<\/span>/)
  assert.ok(bare.includes('«Una frase amb <mark>pa</mark>.»'))
  const win = renderToStaticMarkup(createElement(VocabularyCard, { word: full, unit: allLearningUnits[0], language, headingId: 'w', outcome: { result: 'win', errors: 1 } }))
  assert.ok(win.includes(t.won) && !win.includes('hangman') && win.includes('aria-describedby="w-outcome"'))
  assert.ok(win.includes(`src="/learning/words/${full.illustration}.svg"`) && win.includes(`[${full.ipa}]`))
  assert.ok(win.includes(t.expression) && win.includes(full.expression!.ca) && win.includes(t.note) && win.includes(full.note!))
  assert.ok(win.includes(`<mark>${full.exampleForm ?? full.word}</mark>`))
  const loss = renderToStaticMarkup(createElement(VocabularyCard, { word: full, unit: allLearningUnits[0], language, headingId: 'w', outcome: { result: 'loss', errors: 6 } }))
  assert.ok(loss.includes('vocab-card is-loss') && loss.includes(t.lost) && loss.includes('hangman--compact'), 'a loss is not shown by colour alone')
}
// The heading scales by its longest word; from 12 letters the word takes the full band width (drawing above).
const card = (text: string) => renderToStaticMarkup(createElement(VocabularyCard, { word: word('xx', { word: text, exampleCa: text }), unit: nature, language: 'ca', headingId: 'w' }))
assert.match(card('arc de Sant Martí'), /class="vocab-band">.*style="--chars:5"/)
assert.match(card('col·leccionista'), /class="vocab-band" data-long="true">.*style="--chars:15"/)
console.log('Vocabulary card rendering passed')

// Pages: the unit list (production shows no drafts) and the summary groups.
const page = (units: readonly LearningUnit[], unitId: string | null = null) => renderToStaticMarkup(createElement(LearningPage, { language: 'ca', units, unitId, onUnit: () => {} }))
assert.ok(page([]).includes(learningTranslations.ca.noUnits))
const list = page([nature, unit('d', 'draft')])
assert.ok(list.includes('0 de 12 descobertes · 0%') && list.includes('>Comença</button>') && list.includes('Esborrany'))
const summaryProgress: LearningProgress = { ...emptyProgress(), words: { na: 'correct', nb: 'failed' }, bookmarks: ['nc'] }
const summary = renderToStaticMarkup(createElement(UnitSummary, { unit: nature, pill: null, progress: summaryProgress, stats: unitStats(summaryProgress, nature), language: 'ca', onReview: () => {}, onReplay: () => {}, onUnits: () => {} }))
for (const text of ['Encertades', 'Per repassar', 'Desades', 'Repassa les fallades', 'Torna a jugar la unitat', 'Altres unitats', '2 de 12 paraules descobertes', '17%']) assert.ok(summary.includes(text), text)
console.log('Learning pages passed')

// The real collection: six units of 12, every word playable with the Catalan keyboard (accents, ç, ï and l·l included),
// highlighted in its example, illustrated once, and shown with its grammar on the card.
assert.deepEqual(allLearningUnits.map(({ id }) => id), ['natura', 'animals', 'menjar', 'casa', 'ciutat', 'emocions'])
assert.ok(allLearningUnits.every((item) => item.status === 'ready'), 'all six units are released')
assert.equal(learningUnits.flatMap((item) => item.words).length, 72, 'production (no draft flag) shows all six units and 72 words')
const everyWord = allLearningUnits.flatMap((item) => item.words.map((entry) => ({ unit: item, entry })))
assert.equal(new Set(everyWord.map(({ entry }) => entry.word)).size, 72, 'no word repeats across units')
assert.equal(new Set(everyWord.map(({ entry }) => entry.illustration)).size, 72, 'each word has its own illustration')
for (const { unit: owner, entry } of everyWord) {
  assert.ok(entry.id.startsWith(`${owner.id}-`), `${entry.id} is unit-scoped`)
  assert.ok(entry.grammar && entry.exampleEs, `${entry.id} has grammar and a translated example`)
  let round = createLearningRound(entry.word)
  for (const char of entry.word) round = applyLearningGuess(round, char)
  assert.equal(round.result, 'win', `${entry.word} can be completed`)
  assert.equal(round.errors, 0)
  const markup = renderToStaticMarkup(createElement(VocabularyCard, { word: entry, unit: owner, language: 'ca', headingId: 'w' }))
  assert.ok(markup.includes(`<mark>${entry.exampleCa.slice(entry.exampleCa.toLocaleLowerCase('ca').indexOf((entry.exampleForm ?? entry.word).toLocaleLowerCase('ca'))).slice(0, (entry.exampleForm ?? entry.word).length)}</mark>`), `${entry.id} example highlight`)
}
const byWord = (text: string) => everyWord.find(({ entry }) => entry.word === text)!
const grammarPill = (text: string, language: 'ca' | 'es' = 'ca') => renderToStaticMarkup(createElement(VocabularyCard, { word: byWord(text).entry, unit: byWord(text).unit, language, headingId: 'w' })).match(/class="vocab-grammar">([^<]+)</)?.[1]
assert.equal(grammarPill('guineu'), 'nom femení')
assert.equal(grammarPill('nerviós'), 'adjectiu')
assert.equal(grammarPill('plorar'), 'verb')
assert.equal(grammarPill('plorar', 'es'), 'verbo')
assert.equal(grammarPill('col·legi', 'es'), 'sustantivo masculino')
for (const text of ['col·legi', 'il·lusió', 'veïnat', 'plaça', 'préssec', 'tomàquet', 'nerviós']) assert.ok(byWord(text), text)
// Apostrophes and middle dots are revealed, never guessed; accented letters fold to their base letter.
for (const [text, guesses] of [["d'acord", ['D', 'A', 'C', 'O', 'R']], ['l’àvia', ['L', 'A', 'V', 'I']], ['il·lusió', ['I', 'L', 'U', 'S', 'O']]] as const) {
  let round = createLearningRound(text)
  for (const guess of guesses) round = applyLearningGuess(round, guess)
  assert.equal(round.result, 'win', text)
}
assert.doesNotThrow(() => validateUnits(dataset([unit('x', 'ready', [word('xa', { word: "d'acord", exampleCa: "Estem d'acord." }), ...unit('x').words.slice(1)])])))
// Progress across units: sessions are independent; review and replay work on a real unit without touching the others.
const [natura, , , , , emocions] = allLearningUnits
let shared = startSession(startSession(emptyProgress(), natura), emocions)
shared = acknowledge(recordFinish(shared, 'emocions', { result: 'loss', errors: 6 }), 'emocions')
shared = recordFinish(shared, 'natura', { result: 'win', errors: 0 })
const sharedStorage = memory()
writeLearning(sharedStorage, shared)
const reread = readLearning(sharedStorage, allLearningUnits)
assert.deepEqual(reread, shared)
assert.deepEqual([currentWordId(reread.sessions.emocions), reread.sessions.natura.pending], ['emocions-tristesa', { result: 'win', errors: 0 }])
assert.deepEqual([unitStats(reread, emocions).failed, unitStats(reread, natura).correct], [1, 1])
const reviewed = reviewSession(Object.assign({}, reread, { sessions: {} }), emocions)
assert.deepEqual(reviewed.sessions.emocions.queue, ['emocions-alegria'])
assert.equal(reviewed.sessions.natura, undefined)
assert.equal(replaySession(reread, emocions).sessions.emocions.queue.length, 12)
assert.equal(replaySession(reread, emocions).sessions.natura, reread.sessions.natura)
console.log('Learning collection (6 units, 72 words), grammar categories, punctuation and multi-unit progress passed')
