import { useCallback, useEffect, useRef, useState } from 'react'
import { ALPHABETS, displayWord, normalizeGuess } from '../../shared/game'
import type { Language } from '../../shared/game'
import { HangmanDrawing } from '../components/HangmanDrawing'
import { HangmanWord } from '../components/HangmanWord'
import { Keyboard } from '../components/Keyboard'
import { LearningResultCard } from '../components/LearningResultCard'
import { appendRecentId, applyLearningGuess, createLearningRound, selectNextEntry } from '../learning/game'
import { learningTranslations } from '../learning/i18n'
import type { LearningRound, VocabularyDifficulty } from '../learning/types'
import { vocabulary } from '../learning/vocabulary'

type Props = { language: Language; onHome: () => void }
type LearningPhase = 'setup' | 'playing' | 'round-over'

export function LearningPage({ language, onHome }: Props) {
  const [phase, setPhase] = useState<LearningPhase>('setup')
  const [difficulty, setDifficulty] = useState<VocabularyDifficulty>('easy')
  const [round, setRound] = useState<LearningRound | null>(null)
  const recentIds = useRef<string[]>([])
  const t = learningTranslations[language]

  const startRound = useCallback((selectedDifficulty: VocabularyDifficulty) => {
    const entry = selectNextEntry(vocabulary, selectedDifficulty, recentIds.current)
    recentIds.current = appendRecentId(recentIds.current, entry.id)
    setDifficulty(selectedDifficulty)
    setRound(createLearningRound(entry))
    setPhase('playing')
  }, [])

  const guess = useCallback((letter: string) => {
    setRound((current) => !current || current.result ? current : applyLearningGuess(current, letter))
  }, [])

  useEffect(() => {
    if (round?.result) setPhase('round-over')
  }, [round?.result])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (phase !== 'playing' || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return
      const target = event.target
      if (target instanceof HTMLElement && (target.matches('input, textarea, select, button') || target.isContentEditable)) return
      const normalized = normalizeGuess(event.key, 'ca')
      if (normalized) guess(normalized)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [guess, phase])

  const changeDifficulty = () => { setRound(null); setPhase('setup') }
  const difficultyLabel = t[difficulty]

  return <main className="learning-page" lang={language}>
    <header className="learning-header">
      <div className="brand compact"><span className="brand-mark">H</span><h1>{t.title}</h1></div>
      <button className="text-button" onClick={onHome}>{t.home}</button>
    </header>

    {phase === 'setup' && <section className="learning-setup">
      <span className="eyebrow">Català per a castellanoparlants</span>
      <h2>{t.setupTitle}</h2>
      <fieldset className="difficulty-selector">
        <legend>{t.difficulty}</legend>
        <div>{(['easy', 'medium', 'hard'] as const).map((value) => <button type="button" key={value}
          className={difficulty === value ? 'active' : ''} aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>{t[value]}</button>)}</div>
      </fieldset>
      <p>{t.difficultyHelp}</p>
      <button className="primary-action" onClick={() => startRound(difficulty)}>{t.start}</button>
    </section>}

    {round && phase !== 'setup' && <section className="learning-game">
      <div className="learning-round-meta"><span>{t.currentDifficulty}: <strong>{difficultyLabel}</strong></span><button className="text-button" onClick={changeDifficulty}>{t.changeDifficulty}</button></div>
      <div className="learning-hint"><span>{t.hint}</span><strong lang="es">{round.entry.hintEs}</strong></div>
      <div className="learning-columns">
        <div className="drawing-panel"><HangmanDrawing errors={round.errors} label={t.errors} />
          <div className="error-copy"><span>{t.errors}</span><strong>{round.errors} / 6</strong></div></div>
        <div className="guess-area">
          <div className="learning-word-scroll" tabIndex={0}>
            <HangmanWord word={round.entry.answerCa} guesses={round.guesses} language="ca" reveal={phase === 'round-over'} label={t.progress} />
          </div>
          {phase === 'playing' && <>
            <div className="incorrect-list"><span>{t.incorrect}</span><strong>{round.incorrect.size ? [...round.incorrect].join(' · ') : t.none}</strong></div>
            <Keyboard alphabet={ALPHABETS.ca} guesses={round.guesses} incorrect={round.incorrect} disabled={false} label={t.keyboard} onGuess={guess} />
          </>}
          {phase === 'round-over' && round.result && <LearningResultCard entry={round.entry} result={round.result} language={language}
            onNext={() => startRound(difficulty)} onChangeDifficulty={changeDifficulty} />}
          <span className="sr-only" aria-live="polite">{displayWord(round.entry.answerCa, round.guesses, 'ca', phase === 'round-over').join(' ')}</span>
        </div>
      </div>
    </section>}
  </main>
}
