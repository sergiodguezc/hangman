import { useEffect, useState } from 'react'
import type { Language } from '../shared/game'
import type { ChatMessage, PlayerGameView } from '../shared/protocol'
import { GamePage } from './pages/GamePage'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { LearningPage } from './pages/LearningPage'
import { clearRoomSession, loadRoomSession, socket } from './multiplayer/socket'
import './App.css'

type Route = '/' | '/es/' | '/multijugador/' | '/aprendre/'
type Mode = 'home' | 'multiplayer' | 'learning'

const routeDescriptions: Record<Route, { title: string; description: string; canonical: Route; language: Language; mode: Mode }> = {
  '/': {
    title: 'Penjat — Joc del penjat online en català',
    description: 'Juga al Penjat online en català. Endevina paraules, juga amb amics i aprèn vocabulari català de manera divertida.',
    canonical: '/',
    language: 'ca',
    mode: 'home',
  },
  '/es/': {
    title: 'Penjat — Juego del ahorcado online',
    description: 'Juega a Penjat online en español. Adivina palabras, juega con amigos y aprende vocabulario de forma divertida.',
    canonical: '/es/',
    language: 'es',
    mode: 'home',
  },
  '/multijugador/': {
    title: 'Penjat multijugador — Juga online amb amics',
    description: 'Juga a Penjat multijugador online amb amics. Crea una sala, comparteix el codi i competeix en català.',
    canonical: '/multijugador/',
    language: 'ca',
    mode: 'multiplayer',
  },
  '/aprendre/': {
    title: 'Aprèn català jugant al Penjat | Penjat',
    description: 'Aprèn vocabulari català jugant al Penjat. Descobreix paraules, significats i traduccions mentre jugues.',
    canonical: '/aprendre/',
    language: 'ca',
    mode: 'learning',
  },
}

function normalizeRoute(pathname: string): Route {
  const trimmed = pathname.replace(/\/+$/, '') || '/'
  if (trimmed === '/es') return '/es/'
  if (trimmed === '/multijugador') return '/multijugador/'
  if (trimmed === '/aprendre') return '/aprendre/'
  return trimmed === '/' ? '/' : '/'
}

function App() {
  const [route, setRoute] = useState<Route>(() => {
    const current = normalizeRoute(window.location.pathname)
    if (current !== window.location.pathname) window.history.replaceState({}, '', current)
    return current
  })
  const [language, setLanguage] = useState<Language>(() => routeDescriptions[normalizeRoute(window.location.pathname)].language)
  const [room, setRoom] = useState<PlayerGameView | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [playerId, setPlayerId] = useState(() => loadRoomSession()?.playerId ?? '')
  const [notice, setNotice] = useState('')
  const [typingPlayer, setTypingPlayer] = useState<{ playerId: string; playerName: string } | null>(null)
  const [view, setView] = useState<Mode>(() => routeDescriptions[normalizeRoute(window.location.pathname)].mode)
  const page = routeDescriptions[route]

  useEffect(() => {
    const onPopState = () => {
      const next = normalizeRoute(window.location.pathname)
      if (next !== window.location.pathname) window.history.replaceState({}, '', next)
      setRoute(next)
      setLanguage(routeDescriptions[next].language)
      setView(routeDescriptions[next].mode)
    }
    window.addEventListener('popstate', onPopState)
    const update = (state: PlayerGameView) => { setRoom(state); setLanguage(state.language) }
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
    document.documentElement.lang = page.language
    document.title = page.title
    const canonical = new URL(page.canonical, window.location.origin).href
    const description = page.description
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
    setMeta('meta[property="og:title"]', { property: 'og:title', content: page.title })
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' })
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: page.title })
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    setMeta('link[rel="canonical"]', { rel: 'canonical', href: canonical })
    removeIfPresent('link[rel="alternate"][hreflang]')
    if (route === '/' || route === '/es/') {
      const alternates = [
        { hreflang: 'ca', href: 'https://penjat.cat/' },
        { hreflang: 'es', href: 'https://penjat.cat/es/' },
        { hreflang: 'x-default', href: 'https://penjat.cat/' },
      ]
      for (const alt of alternates) {
        const link = document.createElement('link')
        link.rel = 'alternate'
        link.hreflang = alt.hreflang
        link.href = alt.href
        document.head.appendChild(link)
      }
    }
  }, [page.canonical, page.description, page.language, page.title, route])

  const goTo = (next: Route) => {
    if (next !== route) window.history.pushState({}, '', next)
    setRoute(next)
    setLanguage(routeDescriptions[next].language)
    setView(routeDescriptions[next].mode)
  }

  const changeLanguage = (next: Language) => {
    const target = next === 'es' ? '/es/' : '/'
    setLanguage(next)
    localStorage.setItem('hangman-language', next)
    goTo(target)
  }
  const leave = () => { socket.emit('chat:typing', { isTyping: false }); socket.emit('room:leave'); clearRoomSession(); setPlayerId(''); setRoom(null); setMessages([]); setTypingPlayer(null) }
  const enterRoom = (view: PlayerGameView, id: string) => { setMessages([]); setPlayerId(id); setNotice(''); setRoom(view) }

  useEffect(() => {
    if (room) return
    if (view !== page.mode) setView(page.mode)
  }, [page.mode, room, view])

  useEffect(() => {
    if (room) return
    if (page.language !== language) setLanguage(page.language)
  }, [language, page.language, room])

  const startMultiplayer = () => goTo('/multijugador/')
  const startLearning = () => goTo('/aprendre/')
  const returnHome = () => goTo('/')

  if (!room && view === 'learning') return <LearningPage language={language} onHome={returnHome} />
  if (!room && view === 'multiplayer') return <HomePage language={language} notice={notice} onLanguage={changeLanguage} onEnter={enterRoom} onLearn={startLearning} onMultiplayer={startMultiplayer} mode="multiplayer" />
  if (!room) return <HomePage language={language} notice={notice} onLanguage={changeLanguage} onEnter={enterRoom} onLearn={startLearning} onMultiplayer={startMultiplayer} mode="home" />
  if (room.phase === 'waiting') return <LobbyPage state={room} messages={messages} playerId={playerId} typingPlayer={typingPlayer} onLeave={leave} />
  return <GamePage state={room} messages={messages} playerId={playerId} typingPlayer={typingPlayer} onLeave={leave} />
}

export default App
