import { useCallback, useEffect, useMemo, useState } from 'react'
import { ALPHABETS, displayWord, normalizeGuess } from '../../shared/game'
import type { Language } from '../../shared/game'
import { HangmanDrawing } from '../components/HangmanDrawing'
import { HangmanWord } from '../components/HangmanWord'
import { Keyboard } from '../components/Keyboard'
import { getDailyChallenge, getDailyChallengeUrl, formatDailyShareText } from '../daily/challenge'
import { applyDailyGuess, createDailyRound, type DailyRound } from '../daily/game'
import { dailyTranslations } from '../daily/i18n'
import { readDailyAttempt, writeDailyAttempt } from '../daily/storage'

type Props = { language: Language; onActiveGameChange?: (active: boolean) => void }

export function DailyChallengePage({ language, onActiveGameChange }: Props) {
  const challenge = useMemo(() => getDailyChallenge(), [])
  const [round, setRound] = useState<DailyRound>(() => {
    const stored = readDailyAttempt(localStorage, challenge.id)
    return createDailyRound(challenge.entry, stored?.guesses)
  })
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const t = dailyTranslations[language]
  const completed = round.result !== null

  useEffect(() => {
    writeDailyAttempt(localStorage, {
      challengeId: challenge.id,
      guesses: [...round.guesses],
      completed,
      won: round.result ? round.result === 'win' : null,
      mistakes: round.errors,
    })
  }, [challenge.id, completed, round.errors, round.guesses, round.result])

  useEffect(() => {
    onActiveGameChange?.(!completed && round.guesses.size > 0)
    return () => onActiveGameChange?.(false)
  }, [completed, onActiveGameChange, round.guesses.size])

  const guess = useCallback((letter: string) => {
    setRound((current) => applyDailyGuess(current, letter))
  }, [])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (completed || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return
      const target = event.target
      if (target instanceof HTMLElement && (target.matches('input, textarea, select, button') || target.isContentEditable)) return
      const normalized = normalizeGuess(event.key, 'ca')
      if (normalized) guess(normalized)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [completed, guess])

  const share = async () => {
    if (!round.result) return
    const url = getDailyChallengeUrl(window.location.origin)
    const text = formatDailyShareText({ language, challengeNumber: challenge.number, result: round.result, errors: round.errors, url })
    setShareStatus('idle')
    try {
      if (navigator.share) await navigator.share({ text, url, title: t.heading(challenge.number) })
      else await navigator.clipboard.writeText(text)
      setShareStatus('copied')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareStatus('failed')
    }
  }

  return <main className="daily-page" lang={language}>
    <header className="daily-header">
      <div className="brand compact"><span className="brand-mark">P</span><span className="daily-brand-title">{t.title}</span></div>
    </header>

    <section className="daily-game" aria-labelledby="daily-title">
      <div className="daily-titlebar">
        <span className="eyebrow">{t.eyebrow}</span>
        <h1 id="daily-title">{t.seoTitle}</h1>
        <p className="daily-date">{t.heading(challenge.number)} · {challenge.displayDate[language]}</p>
        <p className="daily-intro">{t.intro}</p>
      </div>
      <div className="daily-columns">
        <div className="drawing-panel">
          <HangmanDrawing errors={round.errors} label={t.errors} />
          <div className="error-copy"><span>{t.errors}</span><strong>{round.errors} / 6</strong></div>
        </div>
        <div className="guess-area">
          <span className="daily-today-label">{t.today}</span>
          <div className="daily-word-scroll" tabIndex={0}>
            <HangmanWord word={challenge.entry.answerCa} guesses={round.guesses} language="ca" reveal={completed} label={t.progress} />
          </div>
          {!completed && <>
            <div className="incorrect-list"><span>{t.incorrect}</span><strong>{round.incorrect.size ? [...round.incorrect].join(' · ') : t.none}</strong></div>
            <Keyboard alphabet={ALPHABETS.ca} guesses={round.guesses} incorrect={round.incorrect} disabled={false} label={t.keyboard} onGuess={guess} />
          </>}
          {completed && <DailyResult round={round} language={language} alreadyPlayed={round.guesses.size > 0} shareStatus={shareStatus} onShare={share} />}
          <span className="sr-only" aria-live="polite">{displayWord(challenge.entry.answerCa, round.guesses, 'ca', completed).join(' ')}</span>
        </div>
      </div>
    </section>
  </main>
}

function DailyResult({ round, language, alreadyPlayed, shareStatus, onShare }: { round: DailyRound; language: Language; alreadyPlayed: boolean; shareStatus: 'idle' | 'copied' | 'failed'; onShare: () => void }) {
  const t = dailyTranslations[language]
  const won = round.result === 'win'
  return <section className={`daily-result ${won ? 'win' : 'loss'}`}>
    {alreadyPlayed && <p className="daily-already">{t.alreadyPlayed}</p>}
    <p className="daily-result-message">{won ? t.won : t.lost}</p>
    <strong className="daily-result-status">{won ? t.victory : t.defeat}</strong>
    <p className="daily-mistakes">{t.mistakes(round.errors)}</p>
    <dl>
      <div><dt>{t.word}</dt><dd lang="ca">{round.entry.answerCa}</dd></div>
      <div><dt>{t.definition}</dt><dd lang="ca">{round.entry.definitionCa}</dd></div>
      <div><dt>{t.spanish}</dt><dd lang="es">{round.entry.translationEs}</dd></div>
    </dl>
    <button type="button" className="primary-action" onClick={onShare}>{t.share}</button>
    {shareStatus !== 'idle' && <p className={`daily-share-status ${shareStatus}`}>{shareStatus === 'copied' ? t.copied : t.shareFailed}</p>}
    <p className="daily-tomorrow">{t.tomorrow}</p>
  </section>
}
