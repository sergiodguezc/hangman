export type VocabularyDifficulty = 'easy' | 'medium' | 'hard'

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
  partOfSpeech?: 'noun' | 'verb' | 'adjective' | 'adverb' | 'other'
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
export type LearningAttemptResult = 'correct' | 'failed'

export type SessionHistoryEntry = {
  position: number
  wordId: string
  result: LearningAttemptResult
}

export type WordSessionStats = {
  appearances: number
  correct: number
  failed: number
  lastSeenAt: number
}

export type LearningSessionStats = {
  total: number
  correct: number
  failed: number
  accuracy: number
  uniqueWords: number
  byWord: Map<string, WordSessionStats>
}

export type LearningRound = {
  entry: VocabularyEntry
  guesses: Set<string>
  incorrect: Set<string>
  errors: number
  result: LearningResult | null
}
