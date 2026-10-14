import unitsJson from '../../data/learning-units.json'
import { normalizeGuess } from '../../shared/game'
import type { Language } from '../../shared/game'
import type { LearningUnit, UnitWord } from './types'

export const UNIT_SIZE = 12
const partsOfSpeech = new Set(['noun', 'verb', 'adjective', 'adverb', 'other'])
const punctuation = new Set([' ', "'", '’', '-', '·'])
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const optionalText = (value: unknown) => value === undefined || text(value)

function wordProblem(word: Partial<UnitWord>): string | null {
  if (![word.id, word.word, word.translationEs, word.definitionCa, word.exampleCa].every(text)) return 'a required field is missing'
  if (![word.ipa, word.exampleForm, word.exampleEs, word.note].every(optionalText)) return 'an optional field is empty'
  const chars = [...word.word!]
  if (!chars.some((char) => normalizeGuess(char, 'ca')) || !chars.every((char) => normalizeGuess(char, 'ca') || punctuation.has(char))) return 'the word is not playable with the Catalan keyboard'
  if (!word.exampleCa!.toLocaleLowerCase('ca').includes((word.exampleForm ?? word.word!).toLocaleLowerCase('ca'))) return 'the example does not contain the word (set exampleForm)'
  if (word.grammar !== undefined && (!partsOfSpeech.has(word.grammar?.pos) || ![undefined, 'm', 'f'].includes(word.grammar.gender))) return 'invalid grammar'
  if (word.expression !== undefined && !(text(word.expression?.ca) && text(word.expression.meaningCa))) return 'invalid expression'
  if (word.illustration !== undefined && !/^[a-z0-9-]+$/.test(word.illustration)) return 'invalid illustration name'
  return null
}

/** Throws on the first broken rule, so a bad dataset fails the build and the tests instead of reaching players. */
export function validateUnits(value: unknown): LearningUnit[] {
  const data = value as { version?: unknown; units?: unknown }
  if (data?.version !== 1 || !Array.isArray(data.units)) throw new Error('learning-units.json must be { version: 1, units: [] }.')
  const ids = new Set<string>()
  const unique = (id: string, where: string) => { if (ids.has(id)) throw new Error(`Duplicate learning ID ${id} in ${where}.`); ids.add(id) }
  for (const unit of data.units as Partial<LearningUnit>[]) {
    if (![unit.id, unit.titleCa, unit.titleEs].every(text) || (unit.status !== 'draft' && unit.status !== 'ready') || !Array.isArray(unit.words)) throw new Error(`Invalid learning unit ${unit.id ?? '(no id)'}.`)
    unique(unit.id!, 'units')
    if (unit.words.length !== UNIT_SIZE) throw new Error(`Learning unit ${unit.id} must have exactly ${UNIT_SIZE} words.`)
    for (const word of unit.words) {
      const problem = wordProblem(word)
      if (problem) throw new Error(`Learning word ${word.id ?? word.word ?? '(no id)'} in ${unit.id}: ${problem}.`)
      unique(word.id, unit.id!)
    }
  }
  return data.units as LearningUnit[]
}

/** Players only see reviewed units; drafts appear in development and in local builds made with VITE_LEARNING_DRAFTS=1. */
export function visibleUnits(units: readonly LearningUnit[], includeDrafts: boolean): LearningUnit[] {
  return units.filter((unit) => includeDrafts || unit.status === 'ready')
}

const env = import.meta.env as ImportMetaEnv | undefined // undefined under tsx (tests)
export const allLearningUnits = validateUnits(unitsJson)
export const learningUnits = visibleUnits(allLearningUnits, env?.DEV === true || env?.VITE_LEARNING_DRAFTS === '1')

export const unitTitle = (unit: LearningUnit, language: Language) => language === 'ca' ? unit.titleCa : unit.titleEs
export const illustrationUrl = (word: UnitWord) => word.illustration ? `/learning/words/${word.illustration}.svg` : null
export const emblemUrl = (unit: LearningUnit) => `/learning/units/${unit.id}.svg`
