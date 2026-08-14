import { useCallback, useEffect, useRef, useState } from 'react'
import { ALPHABETS, displayWord, normalizeGuess } from '../../shared/game'
import type { Language } from '../../shared/game'
import { HangmanDrawing } from '../components/HangmanDrawing'
import { HangmanWord } from '../components/HangmanWord'
import { Keyboard } from '../components/Keyboard'
import { LearningResultCard } from '../components/LearningResultCard'
import { applyLearningGuess, createLearningRound, learningResultToAttemptResult, selectNextEntry, summarizeLearningHistory } from '../learning/game'
import { learningTranslations } from '../learning/i18n'
import type { LearningRound, SessionHistoryEntry, VocabularyDifficulty, VocabularyEntry } from '../learning/types'
import { vocabulary } from '../learning/vocabulary'

type Props = { language: Language; summaryRequested?: boolean; onSummaryShown?: () => void; onExitSummary?: () => void }
type LearningPhase = 'setup' | 'playing' | 'round-over' | 'summary'

const vocabularyById = new Map(vocabulary.map((entry) => [entry.id, entry]))

export function LearningPage({ language, summaryRequested = false, onSummaryShown, onExitSummary }: Props) {
  const [phase, setPhase] = useState<LearningPhase>('setup')
  const [difficulty, setDifficulty] = useState<VocabularyDifficulty>('easy')
  const [round, setRound] = useState<LearningRound | null>(null)
  const [history, setHistory] = useState<SessionHistoryEntry[]>([])
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const completedRoundRef = useRef<LearningRound | null>(null)
  const t = learningTranslations[language]
  const stats = summarizeLearningHistory(history)

  const startRound = useCallback((selectedDifficulty: VocabularyDifficulty, currentHistory: readonly SessionHistoryEntry[] = history) => {
    const entry = selectNextEntry(vocabulary, selectedDifficulty, currentHistory)
    setDifficulty(selectedDifficulty)
    setRound(createLearningRound(entry))
    setHistoryExpanded(false)
    setPhase('playing')
  }, [history])

  const guess = useCallback((letter: string) => {
    setRound((current) => {
      if (!current || current.result) return current
      const next = applyLearningGuess(current, letter)
      if (!current.result && next.result) completedRoundRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    const completed = completedRoundRef.current
    if (!completed?.result) return
    completedRoundRef.current = null
    setHistory((current) => [...current, { position: current.length + 1, wordId: completed.entry.id, result: learningResultToAttemptResult(completed.result) }])
    setPhase('round-over')
  }, [round?.result])

  useEffect(() => {
    if (!summaryRequested) return
    setPhase('summary')
    setRound(null)
    setHistoryExpanded(false)
    onSummaryShown?.()
  }, [onSummaryShown, summaryRequested])

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
      <div className="brand compact"><span className="brand-mark">P</span><h1>{t.title}</h1></div>
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

    {phase === 'summary' && <LearningSummary history={history} expanded={historyExpanded} language={language} onToggleExpanded={() => setHistoryExpanded((expanded) => !expanded)} onExit={onExitSummary} />}

    {round && phase !== 'setup' && phase !== 'summary' && <section className="learning-game">
      <div className="learning-round-meta"><span>{t.currentDifficulty}: <strong>{difficultyLabel}</strong></span><button className="text-button" onClick={changeDifficulty}>{t.changeDifficulty}</button></div>
      <div className="learning-hint"><span>{t.hint}</span><strong lang="es">{round.entry.translationEs}</strong></div>
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
      <LearningSessionPanel history={history} stats={stats} expanded={historyExpanded} language={language} onToggleExpanded={() => setHistoryExpanded((expanded) => !expanded)} />
    </section>}
  </main>
}

function LearningSessionPanel({ history, stats, expanded, language, onToggleExpanded }: { history: SessionHistoryEntry[]; stats: ReturnType<typeof summarizeLearningHistory>; expanded: boolean; language: Language; onToggleExpanded: () => void }) {
  const t = learningTranslations[language]
  return <aside className="learning-session-panel" aria-label={t.sessionProgress}>
    <p className="learning-stats">{t.statsLine(stats.total, stats.correct, stats.failed, stats.accuracy, stats.uniqueWords)}</p>
    <HistoryList history={history} expanded={expanded} language={language} onToggleExpanded={onToggleExpanded} />
  </aside>
}

function LearningSummary({ history, expanded, language, onToggleExpanded, onExit }: { history: SessionHistoryEntry[]; expanded: boolean; language: Language; onToggleExpanded: () => void; onExit?: () => void }) {
  const t = learningTranslations[language]
  const stats = summarizeLearningHistory(history)
  return <section className="learning-summary">
    <span className="eyebrow">{t.title}</span>
    <h2>{t.summaryTitle}</h2>
    {stats.total === 0 ? <p className="learning-summary-empty">{t.emptySummary}</p> : <dl className="learning-summary-stats">
      <SummaryStat label={t.wordsPlayed} value={stats.total} />
      <SummaryStat label={t.correctAttempts} value={stats.correct} />
      <SummaryStat label={t.failedAttempts} value={stats.failed} />
      <SummaryStat label={t.accuracy} value={`${stats.accuracy}%`} />
      <SummaryStat label={t.uniqueWords} value={stats.uniqueWords} />
    </dl>}
    <HistoryList history={history} expanded={expanded} language={language} onToggleExpanded={onToggleExpanded} />
    {onExit && <button className="primary-action" type="button" onClick={onExit}>{t.returnToMenu}</button>}
  </section>
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function HistoryList({ history, expanded, language, onToggleExpanded }: { history: SessionHistoryEntry[]; expanded: boolean; language: Language; onToggleExpanded: () => void }) {
  const t = learningTranslations[language]
  const visible = expanded ? history : history.slice(-5)
  return <section className="learning-history">
    <div className="learning-history-heading"><h3>{t.history}</h3>{history.length > 5 && <button className="text-button" type="button" onClick={onToggleExpanded}>{expanded ? t.showLess : t.showAll}</button>}</div>
    {history.length === 0 ? <p>{t.noHistory}</p> : <ol start={visible[0]?.position} className="learning-history-list">
      {visible.map((item) => <HistoryItem key={`${item.position}-${item.wordId}`} item={item} entry={vocabularyById.get(item.wordId)} />)}
    </ol>}
  </section>
}

function HistoryItem({ item, entry }: { item: SessionHistoryEntry; entry?: VocabularyEntry }) {
  return <li className={item.result}><span aria-hidden="true">{item.result === 'correct' ? '✓' : '×'}</span><strong lang="ca">{entry?.answerCa ?? item.wordId}</strong></li>
}
