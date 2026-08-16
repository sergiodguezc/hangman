import { vocabulary } from '../learning/vocabulary'

export const DAILY_CHALLENGE_WORD_IDS = [
  'aigua',
  'arbre',
  'cadira',
  'carrer',
  'ciutat',
  'cotxe',
  'cultura',
  'davant',
  'desig',
  'diumenge',
  'escola',
  'família',
  'finestra',
  'festa',
  'germà',
  'guerra',
  'jardí',
  'llengua',
  'hivern',
  'hospital',
  'habitació',
  'paraula',
  'platja',
  'feina',
  'porta',
  'pregunta',
  'esquena',
  'setmana',
  'estiu',
  'temps',
  'treball',
  'fusta',
] as const

const vocabularyById = new Map(vocabulary.map((entry) => [entry.id, entry]))

export const dailyWordPool = DAILY_CHALLENGE_WORD_IDS.map((id) => {
  const entry = vocabularyById.get(id)
  if (!entry) throw new Error(`Daily challenge word “${id}” is missing from the vocabulary dataset.`)
  return entry
})
