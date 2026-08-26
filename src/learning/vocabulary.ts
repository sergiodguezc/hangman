import vocabularyJson from '../../data/vocabulary.json'
import type { CefrLevel, LinguisticMetadata, VocabularyDifficulty, VocabularyEntry, VocabularyPartOfSpeech } from './types'

const difficulties = new Set<VocabularyDifficulty>(['easy', 'medium', 'hard'])
const cefrLevels = new Set<CefrLevel>(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
const partsOfSpeech = new Set<VocabularyPartOfSpeech>(['noun', 'verb', 'adjective', 'adverb', 'other'])

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function isLinguisticMetadata(value: unknown): value is LinguisticMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const metadata = value as Partial<LinguisticMetadata>
  const provenance = metadata.provenance
  return (metadata.cefr === undefined || cefrLevels.has(metadata.cefr as CefrLevel))
    && (metadata.confidence === undefined || (typeof metadata.confidence === 'number'
      && Number.isFinite(metadata.confidence)
      && metadata.confidence >= 0
      && metadata.confidence <= 1))
    && (metadata.thematicCategory === undefined || isNonEmptyString(metadata.thematicCategory))
    && (metadata.partOfSpeech === undefined || partsOfSpeech.has(metadata.partOfSpeech as VocabularyPartOfSpeech))
    && (provenance === undefined || (provenance !== null
      && typeof provenance === 'object'
      && !Array.isArray(provenance)
      && isNonEmptyString(provenance.source)
      && (provenance.version === undefined || typeof provenance.version === 'string')
      && (provenance.method === undefined || typeof provenance.method === 'string')))
}

export function isVocabularyEntry(value: unknown): value is VocabularyEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<VocabularyEntry>
  const translations = entry.translationsEs
  return isNonEmptyString(entry.id)
    && isNonEmptyString(entry.word)
    && isNonEmptyString(entry.answerCa)
    && (entry.type === 'word' || entry.type === 'expression')
    && isNonEmptyString(entry.definitionCa)
    && isNonEmptyString(entry.translationEs)
    && isNonEmptyString(entry.hintEs)
    && (translations === undefined || (Array.isArray(translations)
      && translations.length > 0 && translations.length <= 3
      && translations.includes(entry.hintEs)
      && translations.length === 1 && translations[0] === entry.translationEs
      && new Set(translations).size === translations.length
      && translations.every(isNonEmptyString)))
    && isNonEmptyString(entry.exampleCa)
    && difficulties.has(entry.difficulty as VocabularyDifficulty)
    && (entry.linguistics === undefined || isLinguisticMetadata(entry.linguistics))
}

function validateVocabulary(value: unknown): readonly VocabularyEntry[] {
  if (!Array.isArray(value)) throw new Error('Catalan vocabulary must be a JSON array.')
  const invalidIndex = value.findIndex((entry) => !isVocabularyEntry(entry))
  if (invalidIndex !== -1) throw new Error(`Invalid Catalan vocabulary entry at index ${invalidIndex}. Run npm run vocab:validate.`)
  if (value.length === 0) throw new Error('Catalan vocabulary is empty. Run npm run vocab:build.')
  return value
}

export const vocabulary = validateVocabulary(vocabularyJson)
