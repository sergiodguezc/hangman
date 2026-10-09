import { useEffect, useId, useRef } from 'react'
import type { Language } from '../../shared/game'
import { learningTranslations } from '../learning/i18n'
import type { LearningResult, VocabularyEntry } from '../learning/types'
import { HangmanDrawing } from './HangmanDrawing'

type Props = {
  entry: VocabularyEntry
  result: LearningResult
  language: Language
  errors: number
  incorrect: readonly string[]
  onNext: () => void
  onChangeDifficulty: () => void
}

function ExampleSentence({ entry }: { entry: VocabularyEntry }) {
  const index = entry.exampleCa.toLocaleLowerCase('ca').indexOf(entry.answerCa.toLocaleLowerCase('ca'))
  if (index < 0) return <>{entry.exampleCa}</>
  const end = index + entry.answerCa.length
  return <>{entry.exampleCa.slice(0, index)}<strong>{entry.exampleCa.slice(index, end)}</strong>{entry.exampleCa.slice(end)}</>
}

/** Completed-word presentation: the Catalan word appears once, as the heading, and the vocabulary is the main content.
 * The drawing shrinks to a small result mark beside the outcome and the mistake summary. */
export function LearningResultCard({ entry, result, language, errors, incorrect, onNext, onChangeDifficulty }: Props) {
  const t = learningTranslations[language]
  const id = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // The alphabet that had focus is gone: start reading at the word (one announcement, described by the outcome)
  // and bring the card back into view if the player had scrolled down to the keyboard.
  useEffect(() => {
    const active = document.activeElement
    if (!active || active === document.body) headingRef.current?.focus({ preventScroll: true })
    const top = sectionRef.current?.getBoundingClientRect().top ?? 0
    if (top < 0) window.scrollBy({ top: top - 88 })
  }, [])

  return <section ref={sectionRef} className={`learning-result ${result}`} aria-labelledby={`${id}-word`}>
    <div className="learning-result-main">
      <div className="learning-result-status">
        <span className="learning-result-drawing"><HangmanDrawing errors={errors} mood={result} size="compact" /></span>
        <div>
          <p className="learning-result-message" id={`${id}-message`}>{result === 'win' ? t.won : t.lost}</p>
          <p className="learning-result-mistakes">{t.mistakesSummary(errors)}{incorrect.length > 0 && <span className="learning-result-letters"> · {incorrect.join(' ')}</span>}</p>
        </div>
      </div>
      <h2 lang="ca" id={`${id}-word`} ref={headingRef} tabIndex={-1} aria-describedby={`${id}-message ${id}-translation`}>{entry.answerCa}</h2>
      <p className="learning-result-facts">
        <span id={`${id}-translation`}><span className="learning-result-label">{t.spanish}</span> <span lang="es">{entry.translationEs}</span></span>
        {entry.linguistics?.cefr && <span className="learning-result-level"><span className="learning-result-label">{t.cefr}</span> {entry.linguistics.cefr}</span>}
      </p>
    </div>
    <div className="learning-result-details">
      {result === 'loss' && <p className="learning-result-review-note">{t.reviewLater}</p>}
      <dl>
        <div><dt>{t.definition}</dt><dd lang="ca">{entry.definitionCa}</dd></div>
        {entry.exampleCa && <div><dt>{t.example}</dt><dd lang="ca"><ExampleSentence entry={entry} /></dd></div>}
      </dl>
    </div>
    <div className="learning-result-actions">
      <button className="primary-action" onClick={onNext}>{t.next}</button>
      <button className="text-button" onClick={onChangeDifficulty}>{t.changeDifficulty}</button>
    </div>
  </section>
}
