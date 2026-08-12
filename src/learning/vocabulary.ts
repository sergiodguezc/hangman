import vocabularyJson from '../../data/vocabulary.json'
import type { VocabularyDifficulty, VocabularyEntry } from './types'

const difficulties = new Set<VocabularyDifficulty>(['easy', 'medium', 'hard'])

function isVocabularyEntry(value: unknown): value is VocabularyEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<VocabularyEntry>
  return typeof entry.id === 'string' && entry.id.length > 0
    && typeof entry.word === 'string' && entry.word.length > 0
    && Array.isArray(entry.translationEs) && entry.translationEs.length > 0
    && entry.translationEs.every((translation) => typeof translation === 'string' && translation.length > 0)
    && typeof entry.exampleCa === 'string' && entry.exampleCa.length > 0
    && difficulties.has(entry.difficulty as VocabularyDifficulty)
}

function validateVocabulary(value: unknown): readonly VocabularyEntry[] {
  if (!Array.isArray(value)) throw new Error('Catalan vocabulary must be a JSON array.')
  const invalidIndex = value.findIndex((entry) => !isVocabularyEntry(entry))
  if (invalidIndex !== -1) throw new Error(`Invalid Catalan vocabulary entry at index ${invalidIndex}. Run npm run vocab:validate.`)
  if (value.length === 0) throw new Error('Catalan vocabulary is empty. Run npm run vocab:build.')
  return value
}

export const vocabulary = validateVocabulary(vocabularyJson)
