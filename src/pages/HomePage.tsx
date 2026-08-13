import { useEffect, useState, type FormEvent } from 'react'
import type { Language } from '../../shared/game'
import type { MatchTarget, PlayerGameView } from '../../shared/protocol'
import { HangmanDrawing } from '../components/HangmanDrawing'
import { LanguageSelector } from '../components/LanguageSelector'
import { HangmanWord } from '../components/HangmanWord'
import { getLanguageConfig } from '../game/languages'
import { errorMessage, multiplayerTranslations } from '../multiplayer/i18n'
import { saveRoomSession, socket } from '../multiplayer/socket'

type Props = {
  language: Language
  notice?: string
  mode: 'home' | 'multiplayer'
  onLanguage: (language: Language) => void
  onEnter: (view: PlayerGameView, playerId: string) => void
  onLearn: () => void
  onMultiplayer: () => void
  onHelp: () => void
}

export function HomePage({ language, notice, mode, onLanguage, onEnter, onLearn, onMultiplayer, onHelp }: Props) {
  const [panel, setPanel] = useState<'menu' | 'multiplayer'>(mode === 'multiplayer' ? 'multiplayer' : 'menu')
  const [name, setName] = useState(localStorage.getItem('hangman-name') ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [matchTarget, setMatchTarget] = useState<MatchTarget>(5)
  const t = multiplayerTranslations[language]
  const isCatalan = language === 'ca'

  useEffect(() => { setPanel(mode === 'multiplayer' ? 'multiplayer' : 'menu') }, [mode])

  const connect = (done: () => void) => {
    setBusy(true); setError('')
    if (socket.connected) return done()
    socket.connect()
    socket.once('connect', done)
    socket.once('connect_error', () => { setBusy(false); setError(t.connectionError) })
  }

  const create = (event: FormEvent) => {
    event.preventDefault()
    connect(() => socket.emit('room:create', { name, language, matchTarget }, (response) => {
      setBusy(false)
      if (!response.ok) return setError(errorMessage(response.error, t))
      localStorage.setItem('hangman-name', name.trim()); saveRoomSession(response.data.session); onEnter(response.data.view, response.data.session.playerId)
    }))
  }

  const join = () => {
    connect(() => socket.emit('room:join', { name, code }, (response) => {
      setBusy(false)
      if (!response.ok) return setError(errorMessage(response.error, t))
      localStorage.setItem('hangman-name', name.trim()); saveRoomSession(response.data.session); onEnter(response.data.view, response.data.session.playerId)
    }))
  }

  if (panel === 'multiplayer') {
    return <main className="home-page home-page--multiplayer">
      <section className="home-card home-card--join">
        <div className="home-intro home-intro--compact">
          <span className="brand-mark">P</span>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <form onSubmit={create}>
          <label>{t.name}<input value={name} maxLength={24} required placeholder={t.namePlaceholder} onChange={(e) => setName(e.target.value)} /></label>
          <LanguageSelector language={language} label={t.language} onChange={onLanguage} />
          <fieldset className="target-selector"><legend>{t.matchTarget}</legend><div>
            {([3, 5, 10, null] as MatchTarget[]).map((target) => <button type="button" key={target ?? 'unlimited'} className={matchTarget === target ? 'active' : ''} onClick={() => setMatchTarget(target)}>{target === null ? t.unlimited : t.points.replace('{target}', String(target))}</button>)}
          </div><p className="target-help">{t.matchTargetExplanation}</p></fieldset>
          <button className="primary-action" disabled={busy}>{t.create}</button>
          <div className="join-divider"><span>o</span></div>
          <label>{t.roomCode}<input value={code} maxLength={5} placeholder={t.codePlaceholder} autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} /></label>
          <button type="button" className="secondary-action" disabled={busy || !name.trim() || code.length !== 5} onClick={join}>{t.join}</button>
          {(error || notice) && <p className="form-error" role="alert">{error || errorMessage(notice!, t)}</p>}
          <button type="button" className="text-button" onClick={() => setPanel('menu')}>{t.back}</button>
        </form>
      </section>
    </main>
  }

  return <main className="home-page">
    <section className="home-shell">
      <header className="home-topbar">
        <div className="brand home-brand"><span className="brand-mark">P</span><span className="brand-word">PENJAT</span></div>
        <div className="home-topbar-actions">
          <button className="text-button home-help-link" onClick={onHelp}>{isCatalan ? 'Com es juga?' : '¿Cómo se juega?'}</button>
          <LanguageSelector language={language} label={t.language} onChange={onLanguage} />
        </div>
      </header>

      <div className="home-hero">
        <section className="home-copy">
          <span className="eyebrow">{isCatalan ? 'EL JOC DEL PENJAT' : 'EL JUEGO DEL AHORCADO'}</span>
          <h1>{isCatalan ? 'Juga al penjat online en català.' : 'Juega a Penjat online.'}</h1>
          <p>{isCatalan ? 'Juga amb els amics o practica vocabulari mentre jugues.' : 'Juega con tus amigos o practica vocabulario mientras juegas.'}</p>
          <div className="home-actions">
            <button className="primary-action home-cta" onClick={onMultiplayer}>{t.multiplayer}</button>
            <button className="secondary-action home-cta" onClick={onLearn}>{isCatalan ? 'Aprendre català' : 'Practicar catalán'}</button>
          </div>
        </section>
        <aside className="home-preview" aria-hidden="true">
          <div className="preview-board">
            <div className="preview-drawing">
              <HangmanDrawing errors={5} label={isCatalan ? 'Penjat' : 'Ahorcado'} />
            </div>
            <div className="preview-word">
              <HangmanWord word="PENJAT" guesses={new Set(['E', 'J', 'T'])} language={language} reveal={false} label={isCatalan ? 'Progrés de la paraula' : 'Progreso de la palabra'} />
            </div>
          </div>
        </aside>
      </div>

      <footer className="home-footer">
        <button className="text-button home-help-link home-help-link--footer" onClick={onHelp}>{isCatalan ? 'Com es juga?' : '¿Cómo se juega?'}</button>
        <span className="home-domain">penjat.cat</span>
      </footer>
      {notice && <p className="form-error home-notice" role="alert">{errorMessage(notice, t)}</p>}
      <small className="sr-only">{getLanguageConfig(language).name}</small>
    </section>
  </main>
}
