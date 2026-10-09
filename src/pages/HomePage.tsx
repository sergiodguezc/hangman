import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Language } from '../../shared/game'
import { SUPPORTED_VOLTES, type PlayerGameView, type RoomPreview, type Voltes } from '../../shared/protocol'
import { HangmanDrawing } from '../components/HangmanDrawing'
import { LanguageSelector } from '../components/LanguageSelector'
import { getLanguageConfig } from '../game/languages'
import { errorMessage, multiplayerTranslations } from '../multiplayer/i18n'
import { loadRoomSession, saveRoomSession, socket } from '../multiplayer/socket'
import { shouldResumeRoomSession } from '../multiplayer/invitations'
import { DAILY_CHALLENGE_PUBLIC_PATH, getDailyChallenge } from '../daily/challenge'
import { getHomeDailyStatus } from '../daily/homeSummary'
import { dailyTranslations } from '../daily/i18n'
import { homeTranslations } from '../home/i18n'
import { routeClick as route } from '../navigation/links'

type Props = {
  interfaceLanguage: Language
  gameLanguage: Language
  notice?: string
  invitedRoomCode?: string | null
  mode: 'home' | 'multiplayer'
  onGameLanguage: (language: Language) => void
  onEnter: (view: PlayerGameView, playerId: string) => void
  onLearn: () => void
  onDaily?: () => void
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

function readHomeDaily() {
  const challenge = getDailyChallenge()
  try {
    return { number: challenge.number, ...getHomeDailyStatus(challenge, localStorage) }
  } catch {
    return { number: challenge.number, status: 'new' as const, mistakes: 0 }
  }
}

export function HomePage({ interfaceLanguage, gameLanguage, notice, invitedRoomCode = null, mode, onGameLanguage, onEnter, onLearn, onDaily, onMultiplayer, onHelp }: Props) {
  const [panel, setPanel] = useState<'menu' | 'multiplayer'>(mode === 'multiplayer' ? 'multiplayer' : 'menu')
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('hangman-name') ?? '' } catch { return '' }
  })
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [voltes, setVoltes] = useState<Voltes>(3)
  const [invitation, setInvitation] = useState<RoomPreview | null>(null)
  const [invitationStatus, setInvitationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [previewRetry, setPreviewRetry] = useState(0)
  const [showIosInstall, setShowIosInstall] = useState(false)
  const [installExpanded, setInstallExpanded] = useState(false)
  const [daily, setDaily] = useState(readHomeDaily)
  const t = multiplayerTranslations[interfaceLanguage]
  const storedSession = loadRoomSession()
  const invitationOverridesSession = storedSession && !shouldResumeRoomSession(storedSession.roomCode, invitedRoomCode)
  const isCatalan = interfaceLanguage === 'ca'
  const homeCopy = homeTranslations[interfaceLanguage]
  const d = dailyTranslations[interfaceLanguage]
  const previewSlots = ['', 'E', '', 'J', '', 'T']

  useEffect(() => { setPanel(mode === 'multiplayer' ? 'multiplayer' : 'menu') }, [mode])

  // Re-read on return from another tab and after the Madrid date changes while open.
  useEffect(() => {
    if (mode !== 'home') return
    const refresh = () => setDaily(readHomeDaily())
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    refresh()
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [mode])

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
    connect(() => socket.emit('room:create', { name, gameLanguage, voltes }, (response) => {
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
            <p className="page-eyebrow page-eyebrow--mar">{t.multiplayerMode}</p>
            <h1>{t.subtitle}</h1>
          </div>
          {invitationOverridesSession && <p role="status">{t.invitationTakesPriority}</p>}
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
                <div><dt>{t.gameLanguage}</dt><dd>{t.gameLanguageNames[invitation.gameLanguage]}</dd></div>
                <div><dt>{t.voltes}</dt><dd>{invitation.voltes}</dd></div>
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
      <header className="page-head">
        <p className="page-eyebrow page-eyebrow--mar">{t.multiplayerMode}</p>
        <h1>{t.setupTitle} <em>{t.setupAccent}</em></h1>
        <p className="page-lede">{t.subtitle}</p>
      </header>
      <section className="home-card home-card--join">
        <form onSubmit={create}>
          <label className="setup-name">{t.name}<input value={name} maxLength={24} required placeholder={t.namePlaceholder} onChange={(e) => setName(e.target.value)} /></label>
          <div className="setup-panel setup-panel--create">
            <h2>{t.createTitle}</h2>
            <p className="setup-hint">{t.createHint}</p>
            <label className="language-field">
              <span>{t.gameLanguage}</span>
              <LanguageSelector language={gameLanguage} label={t.gameLanguage} onChange={onGameLanguage} />
            </label>
            <p className="target-help">{t.gameLanguageHint}</p>
            <fieldset className="target-selector"><legend>{t.voltes}</legend><div>
              {SUPPORTED_VOLTES.map((value) => <button type="button" key={value} className={voltes === value ? 'active' : ''} onClick={() => setVoltes(value)}>{value}</button>)}
            </div><p className="target-help">{t.voltesExplanation}</p></fieldset>
            <button className="primary-action" disabled={busy}>{t.create}</button>
          </div>
          <div className="join-divider"><span>{t.or}</span></div>
          <div className="setup-panel setup-panel--join">
            <h2>{t.joinTitle}</h2>
            <p className="setup-hint">{t.joinHint}</p>
            <label>{t.roomCode}<input className="room-code-input" value={code} maxLength={5} placeholder={t.codePlaceholder} autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} /></label>
            <button type="button" className="secondary-action" disabled={busy || !name.trim() || code.length !== 5} onClick={join}>{t.join}</button>
          </div>
          {(error || notice) && <p className="form-error" role="alert">{error || errorMessage(notice!, t)}</p>}
        </form>
      </section>
    </main>
  }

  return <main className="home-page">
    <section className="home-shell">
      <div className="home-hero">
        <section className="home-copy">
          <p className="page-eyebrow page-eyebrow--safra">{homeCopy.eyebrow}</p>
          <h1>{isCatalan ? <>Juga al penjat online <em>en català.</em></> : <>Juega a Penjat <em>online.</em></>}</h1>
          <p className="home-lede">{homeCopy.lede}</p>
          <nav className="home-modes" aria-label={homeCopy.modes}>
            <ul className="mode-pair">
              <li><a className="primary-action" href="/multijugador" aria-describedby="home-mp" onClick={route(onMultiplayer)}><ModeIcon mode="multiplayer" />{homeCopy.multiplayer}</a>
                <p className="mode-caption" id="home-mp">{homeCopy.multiplayerCaption}</p></li>
              <li><a className="secondary-action" href="/aprendre" aria-describedby="home-learn" onClick={route(onLearn)}><ModeIcon mode="learning" />{homeCopy.learning}</a>
                <p className="mode-caption" id="home-learn">{homeCopy.learningCaption}</p></li>
              <li className="mode-daily"><a className="daily-entry" href={DAILY_CHALLENGE_PUBLIC_PATH} onClick={route(onDaily)}>
                <ModeIcon mode="daily" />
                <span>
                  <span className="daily-head"><span className="daily-title">{d.title}</span><span className="daily-number">#{daily.number}</span></span>
                  <span className="daily-caption">{daily.status === 'new' ? d.sameForEveryone : <>{daily.status === 'won' ? d.wonWith(daily.mistakes) : d.lost}<span className="daily-sep" aria-hidden="true"> · </span><span className="daily-tomorrow">{d.comeBackTomorrow}</span></>}</span>
                </span>
                <span className="daily-arrow" aria-hidden="true">→</span>
              </a></li>
            </ul>
          </nav>
        </section>
        <aside className="home-preview" aria-hidden="true">
          <span className="preview-tag">{homeCopy.previewTag}</span>
          <div className="preview-board">
            <div className="preview-drawing">
              <HangmanDrawing errors={4} />
            </div>
            <div className="preview-word">
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
      {notice && <p className="form-error home-notice" role="alert">{errorMessage(notice, t)}</p>}

      <section className="home-cards" aria-labelledby="home-cards-title">
        <div className="section-head">
          <h2 id="home-cards-title">{homeCopy.cardsTitle}</h2>
        </div>
        <ul className="mode-cards">
          <ModeCard tone="mar" href="/multijugador" onClick={route(onMultiplayer)} icon={<ModeIcon mode="multiplayer" />} title={homeCopy.multiplayer} body={homeCopy.multiplayerCard} action={homeCopy.multiplayerCardAction}
            art={<span className="mode-art-code">{'K7QF2'.split('').map((letter) => <span key={letter}>{letter}</span>)}</span>} />
          <ModeCard tone="safra" href={DAILY_CHALLENGE_PUBLIC_PATH} onClick={route(onDaily)} icon={<ModeIcon mode="daily" />} title={d.title} body={homeCopy.dailyCard} action={homeCopy.dailyCardAction}
            art={<span className="mode-art-grid">{['hit', 'hit', 'miss', 'hit', 'hit', 'hit', 'miss', 'hit', 'hit', 'hit'].map((cell, index) => <i key={index} className={cell} />)}</span>} />
          <ModeCard tone="oliva" href="/aprendre" onClick={route(onLearn)} icon={<ModeIcon mode="learning" />} title={homeCopy.learning} body={homeCopy.learningCard} action={homeCopy.learningCardAction}
            art={<span className="mode-art-hint"><span lang="es">caracol</span><strong lang="ca">cargol</strong></span>} />
          <ModeCard tone="paper" href="/com-es-juga" onClick={route(onHelp)} icon={<ModeIcon mode="help" />} title={isCatalan ? 'Com es juga' : 'Cómo se juega'} body={homeCopy.helpCard} action={homeCopy.helpCardAction}
            art={<span className="mode-art-drawing"><HangmanDrawing errors={3} /></span>} />
        </ul>
      </section>
      <small className="sr-only">{getLanguageConfig(interfaceLanguage).name}</small>
    </section>
  </main>
}

function ModeCard({ tone, href, onClick, icon, title, body, action, art }: { tone: 'mar' | 'safra' | 'oliva' | 'paper'; href: string; onClick: ReturnType<typeof route>; icon: ReactNode; title: string; body: string; action: string; art: ReactNode }) {
  return <li className={`mode-card mode-card--${tone}`}>
    <a href={href} onClick={onClick}>
      <span className="mode-card-icon">{icon}</span>
      <div className="mode-card-text">
        <h3>{title}</h3>
        <p className="mode-card-body">{body}</p>
        <span className="mode-card-action">{action}<span aria-hidden="true"> →</span></span>
      </div>
      <span className="mode-card-art" aria-hidden="true">{art}</span>
    </a>
  </li>
}

function ModeIcon({ mode }: { mode: 'multiplayer' | 'learning' | 'daily' | 'help' }) {
  return <svg className="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {mode === 'multiplayer' ? <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3 M16 5a3 3 0 0 1 0 6 M18 15a5 5 0 0 1 3 5" /></>
      : mode === 'learning' ? <><path d="M12 5v16 M3 3c4 0 6 0 9 2 3-2 5-2 9-2v16c-4 0-6 0-9 2-3-2-5-2-9-2z" /><path d="M6 8h3 M15 8h3" /></>
      : mode === 'daily' ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18 M8 3v4 M16 3v4" /><path d="M8 14h2 M12 14h2 M8 17h2" /></>
      : <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7 M12 17h.01" /></>}
  </svg>
}
