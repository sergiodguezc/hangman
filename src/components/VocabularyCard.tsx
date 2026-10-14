import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Language } from '../../shared/game'
import { learningTranslations } from '../learning/i18n'
import type { PendingCard } from '../learning/progress'
import type { LearningUnit, UnitWord } from '../learning/types'
import { emblemUrl, illustrationUrl } from '../learning/units'
import { HangmanDrawing } from './HangmanDrawing'

type Props = {
  word: UnitWord
  unit: LearningUnit
  language: Language
  headingId: string
  /** The just-finished attempt; reopened cards (word chips) have none. */
  outcome?: PendingCard
}

function useCatalanVoice() {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const pick = () => setVoice(speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith('ca')) ?? null)
    pick()
    speechSynthesis.addEventListener('voiceschanged', pick)
    return () => speechSynthesis.removeEventListener('voiceschanged', pick)
  }, [])
  return voice
}

function Example({ word }: { word: UnitWord }) {
  const form = word.exampleForm ?? word.word
  const index = word.exampleCa.toLocaleLowerCase('ca').indexOf(form.toLocaleLowerCase('ca'))
  if (index < 0) return <>«{word.exampleCa}»</>
  const end = index + form.length
  return <>«{word.exampleCa.slice(0, index)}<mark>{word.exampleCa.slice(index, end)}</mark>{word.exampleCa.slice(end)}»</>
}

/** The vocabulary-discovery card: the word, its illustration and how it is used. Absent optional fields leave no gap. */
export function VocabularyCard({ word, unit, language, headingId, outcome }: Props) {
  const t = learningTranslations[language]
  const voice = useCatalanVoice()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const art = illustrationUrl(word)
  const longest = Math.max(...word.word.split(' ').map((part) => [...part].length))
  const grammar = word.grammar && [t.grammar[word.grammar.pos], word.grammar.gender && t.gender[word.grammar.gender]].filter(Boolean).join(' ')

  // The keyboard that had focus is gone: start reading at the word and bring the card back into view.
  useEffect(() => {
    if (!outcome) return
    const active = document.activeElement
    if (!active || active === document.body) headingRef.current?.focus({ preventScroll: true })
    const top = headingRef.current?.closest('article')?.getBoundingClientRect().top ?? 0
    if (top < 0) window.scrollBy({ top: top - 88 })
  }, [outcome])

  const speak = () => {
    if (!voice) return
    const utterance = new SpeechSynthesisUtterance(word.word)
    utterance.voice = voice
    utterance.lang = voice.lang
    speechSynthesis.cancel()
    speechSynthesis.speak(utterance)
  }

  return <article className={`vocab-card${outcome?.result === 'loss' ? ' is-loss' : ''}`} aria-labelledby={headingId}>
    <header className="vocab-band" data-long={longest >= 12 || undefined}>
      <div className="vocab-band-text">
        {outcome && <p className="vocab-outcome" id={`${headingId}-outcome`}>
          {outcome.result === 'loss' && <span className="vocab-outcome-mark"><HangmanDrawing errors={outcome.errors} mood="loss" size="compact" /></span>}
          {outcome.result === 'win' ? t.won : t.lost}</p>}
        <h2 lang="ca" id={headingId} ref={headingRef} tabIndex={-1} aria-describedby={outcome ? `${headingId}-outcome` : undefined}
          style={{ '--chars': longest } as CSSProperties}>{word.word}</h2>
        {(word.ipa || voice || grammar) && <p className="vocab-meta">
          {word.ipa && <span className="vocab-ipa" lang="ca-fonipa">[{word.ipa}]</span>}
          {voice && <button type="button" className="vocab-listen" aria-label={t.listen} onClick={speak}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
          </button>}
          {grammar && <span className="vocab-grammar">{grammar}</span>}
        </p>}
      </div>
      {art ? <img className="vocab-art" src={art} alt="" width="160" height="100" decoding="async" />
        : <span className="vocab-art vocab-art--fallback" aria-hidden="true"><img src={emblemUrl(unit)} alt="" width="160" height="100" /><span lang="ca">{word.word[0]}</span></span>}
    </header>
    <div className="vocab-body">
      <section><h3>{t.definition}</h3><p lang="ca">{word.definitionCa}</p></section>
      <section className="vocab-example"><h3>{t.example}</h3><p lang="ca"><Example word={word} /></p>{word.exampleEs && <p className="vocab-example-es" lang="es">{word.exampleEs}</p>}</section>
      <div className="vocab-tiles">
        <section><h3>{t.spanish}</h3><p lang="es"><strong>{word.translationEs}</strong></p></section>
        {word.expression && <section><h3>{t.expression}</h3><p lang="ca"><strong>«{word.expression.ca}»</strong>: {word.expression.meaningCa}</p></section>}
      </div>
      {word.note && <p className="vocab-note"><strong>{t.note}:</strong> <span lang="ca">{word.note}</span></p>}
    </div>
  </article>
}
