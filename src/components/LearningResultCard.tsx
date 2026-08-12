import type { Language } from '../../shared/game'
import { learningTranslations } from '../learning/i18n'
import type { LearningResult, VocabularyEntry } from '../learning/types'

type Props = {
  entry: VocabularyEntry
  result: LearningResult
  language: Language
  onNext: () => void
  onChangeDifficulty: () => void
}

function ExampleSentence({ entry }: { entry: VocabularyEntry }) {
  const index = entry.exampleCa.toLocaleLowerCase('ca').indexOf(entry.answerCa.toLocaleLowerCase('ca'))
  if (index < 0) return <>{entry.exampleCa}</>
  const end = index + entry.answerCa.length
  return <>{entry.exampleCa.slice(0, index)}<strong>{entry.exampleCa.slice(index, end)}</strong>{entry.exampleCa.slice(end)}</>
}

export function LearningResultCard({ entry, result, language, onNext, onChangeDifficulty }: Props) {
  const t = learningTranslations[language]
  return <section className={`learning-result ${result}`} aria-live="polite">
    <p className="learning-result-message">{result === 'win' ? t.won : t.lost}</p>
    <h2 lang="ca">{entry.answerCa}</h2>
    <dl>
      <div><dt>{t.spanish}</dt><dd lang="es">{entry.translationEs}</dd></div>
      <div><dt>Definició</dt><dd lang="ca">{entry.definitionCa}</dd></div>
      <div><dt>{t.example}</dt><dd lang="ca"><ExampleSentence entry={entry} /></dd></div>
    </dl>
    <div className="learning-result-actions">
      <button className="primary-action" onClick={onNext}>{t.next}</button>
      <button className="text-button" onClick={onChangeDifficulty}>{t.changeDifficulty}</button>
    </div>
  </section>
}
