export type VocabularyDifficulty = 'easy' | 'medium' | 'hard'
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type VocabularyPartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'other'

export type LinguisticMetadata = {
  cefr?: CefrLevel
  /** Confidence in this linguistic classification, from 0.0 to 1.0 inclusive. */
  confidence?: number
  thematicCategory?: string
  partOfSpeech?: VocabularyPartOfSpeech
  provenance?: {
    source: string
    version?: string
    method?: string
  }
}

export type VocabularyEntry = {
  id: string
  word: string
  answerCa: string
  type: 'word' | 'expression'
  definitionCa: string
  translationEs: string
  /** Backward-compatible aliases for older data consumers. */
  targetExpression?: string
  hintEs: string
  translationsEs?: string[]
  exampleCa: string
  partOfSpeech?: VocabularyPartOfSpeech
  linguistics?: LinguisticMetadata
  difficulty: VocabularyDifficulty
  corpusCount: number
  frequencyRank?: number
  sources: {
    word: string
    example: string
    frequency?: string
    translation?: string
  }
}

export type LearningResult = 'win' | 'loss'

/** A curated word of a thematic learning unit (data/learning-units.json). Optional fields are hidden when absent. */
export type UnitWord = {
  id: string
  word: string
  translationEs: string
  grammar?: { pos: VocabularyPartOfSpeech; gender?: 'm' | 'f' }
  ipa?: string
  definitionCa: string
  exampleCa: string
  /** The inflected form used in the example, when it is not the word itself. */
  exampleForm?: string
  exampleEs?: string
  expression?: { ca: string; meaningCa: string }
  note?: string
  /** File stem in public/learning/words/. */
  illustration?: string
}

export type LearningUnit = { id: string; titleCa: string; titleEs: string; status: 'draft' | 'ready'; words: UnitWord[] }

export type LearningRound = {
  answer: string
  guesses: Set<string>
  incorrect: Set<string>
  errors: number
  result: LearningResult | null
}
