import { useState, type FormEvent } from 'react'
import type { Language } from '../../shared/game'
import type { MatchTarget, PlayerGameView } from '../../shared/protocol'
import { LanguageSelector } from '../components/LanguageSelector'
import { getLanguageConfig } from '../game/languages'
import { errorMessage, multiplayerTranslations } from '../multiplayer/i18n'
import { saveRoomSession, socket } from '../multiplayer/socket'

type Props = { language: Language; notice?: string; onLanguage: (language: Language) => void; onEnter: (view: PlayerGameView, playerId: string) => void }

export function HomePage({ language, notice, onLanguage, onEnter }: Props) {
  const [name, setName] = useState(localStorage.getItem('hangman-name') ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [matchTarget, setMatchTarget] = useState<MatchTarget>(5)
  const t = multiplayerTranslations[language]
  const otherLanguage: Language = language === 'es' ? 'ca' : 'es'
  const otherTitle = multiplayerTranslations[otherLanguage].title

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

  return <main className="home-page">
    <section className="home-card">
      <div className="home-intro"><span className="brand-mark">H</span><h1>{t.title} <em>/ {otherTitle}</em></h1><p>{t.subtitle}</p></div>
      <form onSubmit={create}>
        <label>{t.name}<input value={name} maxLength={24} required placeholder={t.namePlaceholder} onChange={(e) => setName(e.target.value)} /></label>
        <LanguageSelector language={language} label={t.language} onChange={onLanguage} />
        <fieldset className="target-selector"><legend>{t.matchTarget}</legend><div>
          {([3, 5, 10, null] as MatchTarget[]).map((target) => <button type="button" key={target ?? 'unlimited'} className={matchTarget === target ? 'active' : ''} onClick={() => setMatchTarget(target)}>{target === null ? t.unlimited : t.points.replace('{target}', String(target))}</button>)}
        </div><p className="word-privacy">{t.matchTargetExplanation}</p></fieldset>
        <button className="primary-action" disabled={busy}>{t.create}</button>
        <div className="join-divider"><span>o</span></div>
        <label>{t.roomCode}<input value={code} maxLength={5} placeholder={t.codePlaceholder} autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} /></label>
        <button type="button" className="secondary-action" disabled={busy || !name.trim() || code.length !== 5} onClick={join}>{t.join}</button>
        {(error || notice) && <p className="form-error" role="alert">{error || errorMessage(notice!, t)}</p>}
      </form>
      <small>{getLanguageConfig(language).name}</small>
    </section>
  </main>
}
