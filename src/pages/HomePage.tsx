import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Language } from '../../shared/game'
import type { MatchTarget, PlayerGameView, RoomPreview } from '../../shared/protocol'
import { HangmanDrawing } from '../components/HangmanDrawing'
import { LanguageSelector } from '../components/LanguageSelector'
import { getLanguageConfig } from '../game/languages'
import { errorMessage, multiplayerTranslations } from '../multiplayer/i18n'
import { saveRoomSession, socket } from '../multiplayer/socket'

type Props = {
  interfaceLanguage: Language
  gameLanguage: Language
  notice?: string
  invitedRoomCode?: string | null
  mode: 'home' | 'multiplayer'
  onGameLanguage: (language: Language) => void
  onEnter: (view: PlayerGameView, playerId: string) => void
  onLearn: () => void
  onMultiplayer: () => void
  onHelp: () => void
}

function isIosDevice() {
  const platform = navigator.platform || ''
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalonePwa() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function HomePage({ interfaceLanguage, gameLanguage, notice, invitedRoomCode = null, mode, onGameLanguage, onEnter, onLearn, onMultiplayer, onHelp }: Props) {
  const [panel, setPanel] = useState<'menu' | 'multiplayer'>(mode === 'multiplayer' ? 'multiplayer' : 'menu')
  const [name, setName] = useState(localStorage.getItem('hangman-name') ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [matchTarget, setMatchTarget] = useState<MatchTarget>(5)
  const [invitation, setInvitation] = useState<RoomPreview | null>(null)
  const [invitationStatus, setInvitationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [previewRetry, setPreviewRetry] = useState(0)
  const [showIosInstall, setShowIosInstall] = useState(false)
  const [installExpanded, setInstallExpanded] = useState(false)
  const t = multiplayerTranslations[interfaceLanguage]
  const isCatalan = interfaceLanguage === 'ca'
  const previewSlots = ['', 'E', '', 'J', '', 'T']

  useEffect(() => { setPanel(mode === 'multiplayer' ? 'multiplayer' : 'menu') }, [mode])

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const updateInstallHint = () => setShowIosInstall(isIosDevice() && !isStandalonePwa())
    updateInstallHint()
    displayMode.addEventListener('change', updateInstallHint)
    return () => displayMode.removeEventListener('change', updateInstallHint)
  }, [])

  const connect = useCallback((done: () => void, onError?: (error: string) => void) => {
    setBusy(true); setError('')
    if (socket.connected) return done()
    const handleConnect = () => {
      socket.off('connect_error', handleError)
      done()
    }
    const handleError = () => {
      socket.off('connect', handleConnect)
      setBusy(false)
      setError('connect_error')
      onError?.('connect_error')
    }
    socket.connect()
    socket.once('connect', handleConnect)
    socket.once('connect_error', handleError)
  }, [])

  useEffect(() => {
    if (mode !== 'multiplayer' || invitedRoomCode === null) {
      setInvitation(null)
      setInvitationStatus('idle')
      return
    }
    if (!invitedRoomCode) {
      setInvitation(null)
      setInvitationStatus('error')
      setError('invalid-invitation')
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setInvitation(null)
    setInvitationStatus('loading')
    setError('')
    setBusy(true)
    fetch(`/api/rooms/${encodeURIComponent(invitedRoomCode)}/preview`, { signal: controller.signal, cache: 'no-store' })
      .then(async (previewResponse) => {
        const response = await previewResponse.json() as { ok: true; data: RoomPreview } | { ok: false; error: string }
        if (cancelled) return
        setBusy(false)
        if (!response.ok) {
          setInvitationStatus('error')
          setError(response.error)
          return
        }
        setInvitation(response.data)
        setCode(response.data.code)
        setInvitationStatus('ready')
      })
      .catch((fetchError) => {
        if (cancelled || fetchError instanceof DOMException && fetchError.name === 'AbortError') return
        setBusy(false)
        setInvitationStatus('error')
        setError('preview-load-failed')
      })
    return () => { cancelled = true; controller.abort() }
  }, [invitedRoomCode, mode, previewRetry])

  const create = (event: FormEvent) => {
    event.preventDefault()
    connect(() => socket.emit('room:create', { name, gameLanguage, matchTarget }, (response) => {
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
    if (invitedRoomCode !== null) {
      return <main className="home-page home-page--multiplayer">
        <section className="home-card home-card--join invitation-card">
          <div className="home-intro home-intro--compact">
            <span className="brand-mark">P</span>
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
          {invitationStatus === 'loading' && <p className="invitation-loading">{t.invitationLoading}</p>}
          {invitationStatus === 'error' && <div className="invitation-invalid">
            <h2>{t.invitationUnavailable}</h2>
            <p className="form-error" role="alert">{errorMessage(error || 'room-not-found', t)}</p>
            <div className="invitation-error-actions">
              {invitedRoomCode && <button type="button" className="primary-action" onClick={() => setPreviewRetry((current) => current + 1)}>{t.retryInvitation}</button>}
              <button type="button" className="secondary-action" onClick={onMultiplayer}>{t.goToMultiplayer}</button>
            </div>
          </div>}
          {invitationStatus === 'ready' && invitation && <form className="invitation-form">
            <h2>{t.invitationHeading}</h2>
            <section className="invitation-rules" aria-labelledby="invitation-rules-title">
              <h3 id="invitation-rules-title">{t.invitationRules}</h3>
              <dl>
                <div><dt>{t.gameLanguage}</dt><dd>{getLanguageConfig(invitation.gameLanguage).name}</dd></div>
                <div><dt>{t.matchTarget}</dt><dd>{invitation.matchTarget === null ? t.unlimited : t.points.replace('{target}', String(invitation.matchTarget))}</dd></div>
              </dl>
            </section>
            <label>{t.name}<input value={name} maxLength={24} required placeholder={t.namePlaceholder} onChange={(e) => setName(e.target.value)} /></label>
            <button type="button" className="primary-action" disabled={busy || !name.trim()} onClick={join}>{t.joinInvitation}</button>
            {(error || notice) && <p className="form-error" role="alert">{errorMessage(error || notice!, t)}</p>}
            <div className="invitation-alternative">
              <span>{t.preferDifferentRules}</span>
              <button type="button" className="text-button" onClick={onMultiplayer}>{t.createYourGame}</button>
            </div>
          </form>}
        </section>
      </main>
    }

    return <main className="home-page home-page--multiplayer">
      <section className="home-card home-card--join">
        <div className="home-intro home-intro--compact">
          <span className="brand-mark">P</span>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <form onSubmit={create}>
          <label>{t.name}<input value={name} maxLength={24} required placeholder={t.namePlaceholder} onChange={(e) => setName(e.target.value)} /></label>
          <label className="language-field">
            <span>{t.gameLanguage}</span>
            <LanguageSelector language={gameLanguage} label={t.gameLanguage} onChange={onGameLanguage} />
          </label>
          <p className="target-help">{t.gameLanguageHint}</p>
          <fieldset className="target-selector"><legend>{t.matchTarget}</legend><div>
            {([3, 5, 10, null] as MatchTarget[]).map((target) => <button type="button" key={target ?? 'unlimited'} className={matchTarget === target ? 'active' : ''} onClick={() => setMatchTarget(target)}>{target === null ? t.unlimited : t.points.replace('{target}', String(target))}</button>)}
          </div><p className="target-help">{t.matchTargetExplanation}</p></fieldset>
          <button className="primary-action" disabled={busy}>{t.create}</button>
          <div className="join-divider"><span>o</span></div>
          <label>{t.roomCode}<input value={code} maxLength={5} placeholder={t.codePlaceholder} autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} /></label>
          <button type="button" className="secondary-action" disabled={busy || !name.trim() || code.length !== 5} onClick={join}>{t.join}</button>
          {(error || notice) && <p className="form-error" role="alert">{error || errorMessage(notice!, t)}</p>}
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
              <HangmanDrawing errors={6} label={isCatalan ? 'Penjat' : 'Ahorcado'} />
            </div>
            <div className="preview-word" aria-label={isCatalan ? 'Progrés de la paraula' : 'Progreso de la palabra'}>
              {previewSlots.map((letter, index) => <span key={`${letter || 'blank'}-${index}`} className="preview-letter">{letter}</span>)}
            </div>
          </div>
        </aside>
      </div>

      {showIosInstall && <section className="ios-install-card" aria-labelledby="ios-install-title">
        <button type="button" className="ios-install-toggle" aria-expanded={installExpanded} aria-controls="ios-install-content" onClick={() => setInstallExpanded((expanded) => !expanded)}>
          <span className="ios-install-summary"><span id="ios-install-title">{t.iosInstallSummary}</span></span>
          <svg className="ios-install-chevron" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
        <div id="ios-install-content" className="ios-install-content" aria-hidden={!installExpanded}>
          <div className="ios-install-content-inner">
            <p>{t.iosInstallIntro}</p>
            <ol>
              <li>{t.iosInstallOpenPrefix} <strong>{t.iosInstallSite}</strong> {t.iosInstallOpenMiddle} <strong>{t.iosInstallBrowser}</strong>.</li>
              <li>{t.iosInstallTapButton} <strong>{t.iosInstallShare}</strong>.</li>
              <li>{t.iosInstallSelect} <strong>{t.iosInstallAddHome}</strong>.</li>
              <li>{t.iosInstallTap} <strong>{t.iosInstallAdd}</strong>.</li>
            </ol>
            <p>{t.iosInstallOutro}</p>
          </div>
        </div>
      </section>}

      <footer className="home-footer">
        <button className="text-button home-help-link home-help-link--footer" onClick={onHelp}>{isCatalan ? 'Com es juga?' : '¿Cómo se juega?'}</button>
        <span className="home-domain">penjat.cat</span>
      </footer>
      {notice && <p className="form-error home-notice" role="alert">{errorMessage(notice, t)}</p>}
      <small className="sr-only">{getLanguageConfig(interfaceLanguage).name}</small>
    </section>
  </main>
}
