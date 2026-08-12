export type VocabularyDifficulty = 'easy' | 'medium' | 'hard'

export type VocabularyEntry = {
  id: string
  word: string
  answerCa: string
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

export type LearningRound = {
  entry: VocabularyEntry
  guesses: Set<string>
  incorrect: Set<string>
  errors: number
  result: LearningResult | null
}
