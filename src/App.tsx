import { useEffect, useState } from 'react'
import type { Language } from '../shared/game'
import type { ChatMessage, PlayerGameView } from '../shared/protocol'
import { GamePage } from './pages/GamePage'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { LearningPage } from './pages/LearningPage'
import { DailyChallengePage } from './pages/DailyChallengePage'
import { HowToPlayPage } from './pages/HowToPlayPage'
import { InterfaceLanguageSelector } from './components/InterfaceLanguageSelector'
import { GlobalNavigation } from './components/GlobalNavigation'
import { INTERFACE_LANGUAGE_STORAGE_KEY, readInterfaceLanguage } from './localization'
import { normalizeInvitationCode } from './multiplayer/invitations'
import { clearRoomSession, loadRoomSession, socket } from './multiplayer/socket'
import { normalizeRoute, type Route } from './routing'
import './App.css'

type Mode = 'home' | 'multiplayer' | 'learning' | 'daily' | 'help'
type PageCopy = { title: string; description: string }
type InvitationCode = string | null
const PUBLIC_SITE_ORIGIN = 'https://penjat.cat'

function readInvitationCode(): InvitationCode {
  const params = new URLSearchParams(window.location.search)
  return params.has('sala') ? normalizeInvitationCode(params.get('sala')) : null
}

const routeDescriptions: Record<Route, { mode: Mode; copy: Record<Language, PageCopy> }> = {
  '/': {
    mode: 'home',
    copy: {
      ca: { title: 'Penjat — Joc del penjat online en català', description: 'Juga al Penjat online en català. Endevina paraules, juga amb amics i aprèn vocabulari català de manera divertida.' },
      es: { title: 'Penjat — Juego del ahorcado online', description: 'Juega a Penjat online en español. Adivina palabras, juega con amigos y aprende vocabulario de forma divertida.' },
    },
  },
  '/multijugador/': {
    mode: 'multiplayer',
    copy: {
      ca: { title: 'Penjat multijugador — Juga online amb amics', description: 'Juga a Penjat multijugador online amb amics. Crea una sala, comparteix el codi i competeix en català o castellà.' },
      es: { title: 'Penjat multijugador — Juega online con amigos', description: 'Juega a Penjat multijugador online con amigos. Crea una sala, comparte el código y compite en catalán o español.' },
    },
  },
  '/aprendre/': {
    mode: 'learning',
    copy: {
      ca: { title: 'Aprèn català jugant al Penjat | Penjat', description: 'Aprèn vocabulari català jugant al Penjat. Descobreix paraules, significats i traduccions mentre jugues.' },
      es: { title: 'Aprende catalán jugando a Penjat | Penjat', description: 'Aprende vocabulario catalán jugando a Penjat. Descubre palabras, significados y traducciones mientras juegas.' },
    },
  },
  '/paraula-del-dia/': {
    mode: 'daily',
    copy: {
      ca: { title: 'Paraula del dia en català | Penjat', description: 'Descobreix la paraula del dia en català jugant al Penjat. Una nova paraula cada dia per posar a prova el teu vocabulari.' },
      es: { title: 'Palabra del día en catalán | Penjat', description: 'Descubre la palabra del día en catalán jugando a Penjat. Una nueva palabra cada día para poner a prueba tu vocabulario.' },
    },
  },
  '/com-es-juga/': {
    mode: 'help',
    copy: {
      ca: { title: 'Com es juga a Penjat? | Penjat', description: 'Descobreix com es juga a Penjat, tant en multijugador com en mode d’aprenentatge de català.' },
      es: { title: '¿Cómo se juega a Penjat? | Penjat', description: 'Descubre cómo jugar a Penjat, tanto en multijugador como en el modo de aprendizaje de catalán.' },
    },
  },
}

function App() {
  const [route, setRoute] = useState<Route>(() => {
    const current = normalizeRoute(window.location.pathname)
    if (current !== window.location.pathname) window.history.replaceState({}, '', `${current}${window.location.search}`)
    return current
  })
  const [interfaceLanguage, setInterfaceLanguage] = useState<Language>(() => readInterfaceLanguage(localStorage))
  const [gameLanguage, setGameLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem('hangman-game-language')
    return stored === 'es' || stored === 'ca' ? stored : 'ca'
  })
  const [room, setRoom] = useState<PlayerGameView | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [playerId, setPlayerId] = useState(() => loadRoomSession()?.playerId ?? '')
  const [notice, setNotice] = useState('')
  const [typingPlayer, setTypingPlayer] = useState<{ playerId: string; playerName: string } | null>(null)
  const [view, setView] = useState<Mode>(() => routeDescriptions[normalizeRoute(window.location.pathname)].mode)
  const [learningSummaryRequested, setLearningSummaryRequested] = useState(false)
  const [learningSummaryVisible, setLearningSummaryVisible] = useState(false)
  const [learningGameActive, setLearningGameActive] = useState(false)
  const [dailyGameActive, setDailyGameActive] = useState(false)
  const [invitedRoomCode, setInvitedRoomCode] = useState<InvitationCode>(() => readInvitationCode())
  const [pendingExit, setPendingExit] = useState<(() => void) | null>(null)
  const page = routeDescriptions[route]

  useEffect(() => {
    const onPopState = () => {
      const next = normalizeRoute(window.location.pathname)
      if (next !== window.location.pathname) window.history.replaceState({}, '', `${next}${window.location.search}`)
      setRoute(next)
      setView(routeDescriptions[next].mode)
      setInvitedRoomCode(next === '/multijugador/' ? readInvitationCode() : null)
    }
    window.addEventListener('popstate', onPopState)
    const update = (state: PlayerGameView) => { setRoom(state); setGameLanguage(state.gameLanguage); localStorage.setItem('hangman-game-language', state.gameLanguage) }
    socket.on('room:state', update)
    const history = (chatMessages: ChatMessage[]) => setMessages(chatMessages)
    const message = (chatMessage: ChatMessage) => setMessages((current) => [...current, chatMessage].slice(-50))
    socket.on('chat:history', history)
    socket.on('chat:message', message)
    const reaction = ({ messageId, reactions }: { messageId: string; reactions: ChatMessage['reactions'] }) => setMessages((current) => current.map((item) => item.id === messageId ? { ...item, reactions } : item))
    socket.on('chat:reaction-updated', reaction)
    const typing = (payload: { playerId: string; playerName: string; isTyping: boolean }) => setTypingPlayer(payload.isTyping ? payload : null)
    socket.on('chat:typing', typing)
    const resume = () => {
      const session = loadRoomSession()
      if (!session) return
      socket.emit('room:resume', session, (response) => {
        if (response.ok) { setPlayerId(session.playerId); setRoom(response.data); return }
        clearRoomSession(); setPlayerId(''); setRoom(null); setMessages([]); setNotice(response.error)
      })
    }
    socket.on('connect', resume)
    if (!socket.connected) socket.connect(); else resume()
    return () => {
      window.removeEventListener('popstate', onPopState)
      socket.off('room:state', update); socket.off('chat:history', history); socket.off('chat:message', message); socket.off('chat:reaction-updated', reaction); socket.off('chat:typing', typing); socket.off('connect', resume)
    }
  }, [])

  useEffect(() => {
    const copy = page.copy[interfaceLanguage]
    document.documentElement.lang = interfaceLanguage
    document.title = copy.title
    const canonical = new URL(canonicalPath(route), PUBLIC_SITE_ORIGIN).href
    const description = copy.description
    const setMeta = (selector: string, attrs: Record<string, string>) => {
      let element = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector)
      if (!element) {
        element = selector.startsWith('link') ? document.createElement('link') : document.createElement('meta')
        document.head.append(element)
      }
      for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value)
    }
    const removeIfPresent = (selector: string) => document.head.querySelectorAll(selector).forEach((node) => node.remove())
    setMeta('meta[name="description"]', { name: 'description', content: description })
    setMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Penjat' })
    setMeta('meta[property="og:title"]', { property: 'og:title', content: copy.title })
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' })
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: copy.title })
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    setMeta('link[rel="canonical"]', { rel: 'canonical', href: canonical })
    removeIfPresent('link[rel="alternate"][hreflang]')
  }, [interfaceLanguage, page, route])

  const goTo = (next: Route, options: { replace?: boolean } = {}) => {
    if (next !== route || window.location.search) {
      const method = options.replace ? 'replaceState' : 'pushState'
      window.history[method]({}, '', next)
    }
    setRoute(next)
    setView(routeDescriptions[next].mode)
    setInvitedRoomCode(null)
    if (next !== '/aprendre/') {
      setLearningSummaryRequested(false)
      setLearningSummaryVisible(false)
    }
  }

  const changeInterfaceLanguage = (next: Language) => {
    setInterfaceLanguage(next)
    localStorage.setItem(INTERFACE_LANGUAGE_STORAGE_KEY, next)
  }
  const changeGameLanguage = (next: Language) => {
    setGameLanguage(next)
    localStorage.setItem('hangman-game-language', next)
  }
  const leave = () => {
    socket.emit('chat:typing', { isTyping: false })
    socket.emit('room:leave')
    clearRoomSession()
    setPlayerId('')
    setRoom(null)
    setMessages([])
    setTypingPlayer(null)
    goTo('/multijugador/', { replace: true })
  }
  const enterRoom = (view: PlayerGameView, id: string) => {
    setMessages([])
    setPlayerId(id)
    setNotice('')
    setRoom(view)
    if (route === '/multijugador/' && window.location.search) goTo('/multijugador/', { replace: true })
  }

  useEffect(() => {
    if (room) return
    if (view !== page.mode) setView(page.mode)
  }, [page.mode, room, view])

  const startMultiplayer = () => goTo('/multijugador/')
  const startLearning = () => goTo('/aprendre/')
  const startDaily = () => goTo('/paraula-del-dia/')
  const startHelp = () => goTo('/com-es-juga/')
  const returnHome = () => goTo('/')
  const learningBack = () => {
    if (learningSummaryVisible) { returnHome(); return }
    setLearningSummaryRequested(true)
  }
  const markLearningSummaryShown = () => {
    setLearningSummaryRequested(false)
    setLearningSummaryVisible(true)
  }

  const interfaceSelector = <InterfaceLanguageSelector language={interfaceLanguage} onChange={changeInterfaceLanguage} />
  const showBack = !room && view !== 'home'
  const backLabel = room ? (interfaceLanguage === 'ca' ? 'Tornar' : 'Volver') : (interfaceLanguage === 'ca' ? 'Tornar enrere' : 'Volver')
  const multiplayerGameActive = room ? !['waiting', 'match-over', 'disconnected'].includes(room.phase) : false
  const requestConfirmedExit = (exit: () => void, requiresConfirmation: boolean) => {
    if (!requiresConfirmation) { exit(); return }
    setPendingExit(() => exit)
  }
  const cancelExit = () => setPendingExit(null)
  const confirmExit = () => {
    const exit = pendingExit
    setPendingExit(null)
    exit?.()
  }
  const exitDialog = pendingExit ? <ExitConfirmationDialog language={interfaceLanguage} onCancel={cancelExit} onConfirm={confirmExit} /> : null

  if (!room && view === 'learning') return <><GlobalNavigation showBack={showBack} backLabel={backLabel} onBack={() => requestConfirmedExit(learningBack, learningGameActive)} /><LearningPage language={interfaceLanguage} summaryRequested={learningSummaryRequested} onActiveGameChange={setLearningGameActive} onSummaryShown={markLearningSummaryShown} onExitSummary={returnHome} />{interfaceSelector}{exitDialog}</>
  if (!room && view === 'daily') return <><GlobalNavigation showBack={showBack} backLabel={backLabel} onBack={() => requestConfirmedExit(returnHome, dailyGameActive)} /><DailyChallengePage language={interfaceLanguage} onActiveGameChange={setDailyGameActive} />{interfaceSelector}{exitDialog}</>
  if (!room && view === 'multiplayer') return <><GlobalNavigation showBack={showBack} backLabel={backLabel} onBack={returnHome} /><HomePage interfaceLanguage={interfaceLanguage} gameLanguage={gameLanguage} notice={notice} invitedRoomCode={invitedRoomCode} onGameLanguage={changeGameLanguage} onEnter={enterRoom} onLearn={startLearning} onMultiplayer={startMultiplayer} onHelp={startHelp} mode="multiplayer" />{interfaceSelector}{exitDialog}</>
  if (!room && view === 'help') return <><GlobalNavigation showBack={showBack} backLabel={backLabel} onBack={returnHome} /><HowToPlayPage language={interfaceLanguage} />{interfaceSelector}{exitDialog}</>
  if (!room) return <><GlobalNavigation showBack={showBack} backLabel={backLabel} onBack={returnHome} /><HomePage interfaceLanguage={interfaceLanguage} gameLanguage={gameLanguage} notice={notice} onGameLanguage={changeGameLanguage} onEnter={enterRoom} onLearn={startLearning} onDaily={startDaily} onMultiplayer={startMultiplayer} onHelp={startHelp} mode="home" />{interfaceSelector}{exitDialog}</>
  if (room.phase === 'waiting') return <><GlobalNavigation showBack backLabel={backLabel} onBack={leave} /><LobbyPage state={room} interfaceLanguage={interfaceLanguage} messages={messages} playerId={playerId} typingPlayer={typingPlayer} />{interfaceSelector}{exitDialog}</>
  return <><GlobalNavigation showBack backLabel={backLabel} onBack={() => requestConfirmedExit(leave, multiplayerGameActive)} /><GamePage state={room} interfaceLanguage={interfaceLanguage} messages={messages} playerId={playerId} typingPlayer={typingPlayer} />{interfaceSelector}{exitDialog}</>
}

export default App

function canonicalPath(route: Route): string {
  return route === '/' ? '/' : route.replace(/\/$/, '')
}

function ExitConfirmationDialog({ language, onCancel, onConfirm }: { language: Language; onCancel: () => void; onConfirm: () => void }) {
  const copy = language === 'ca' ? {
    title: 'Vols acabar la partida?',
    body: "Si surts ara, la partida actual s'acabarà.",
    cancel: 'Cancel·la',
    confirm: 'Acaba la partida',
  } : {
    title: '¿Quieres terminar la partida?',
    body: 'Si sales ahora, la partida actual terminará.',
    cancel: 'Cancelar',
    confirm: 'Terminar partida',
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [onCancel])

  return <div className="exit-confirmation-backdrop" role="presentation">
    <section className="exit-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="exit-confirmation-title" aria-describedby="exit-confirmation-copy">
      <h2 id="exit-confirmation-title">{copy.title}</h2>
      <p id="exit-confirmation-copy">{copy.body}</p>
      <div className="exit-confirmation-actions">
        <button type="button" className="secondary-action" autoFocus onClick={onCancel}>{copy.cancel}</button>
        <button type="button" className="primary-action danger-action" onClick={onConfirm}>{copy.confirm}</button>
      </div>
    </section>
  </div>
}
