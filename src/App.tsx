import { useEffect, useState } from 'react'
import type { Language } from '../shared/game'
import type { ChatMessage, PlayerGameView } from '../shared/protocol'
import { GamePage } from './pages/GamePage'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { socket } from './multiplayer/socket'
import './App.css'

function App() {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('hangman-language') === 'ca' ? 'ca' : 'es')
  const [room, setRoom] = useState<PlayerGameView | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    const update = (state: PlayerGameView) => { setRoom(state); setLanguage(state.language) }
    socket.on('room:state', update)
    const history = (chatMessages: ChatMessage[]) => setMessages(chatMessages)
    const message = (chatMessage: ChatMessage) => setMessages((current) => [...current, chatMessage].slice(-50))
    socket.on('chat:history', history)
    socket.on('chat:message', message)
    return () => { socket.off('room:state', update); socket.off('chat:history', history); socket.off('chat:message', message) }
  }, [])

  const changeLanguage = (next: Language) => { setLanguage(next); localStorage.setItem('hangman-language', next) }
  const leave = () => { socket.emit('room:leave'); socket.disconnect(); setRoom(null); setMessages([]) }
  const enterRoom = (view: PlayerGameView) => { setMessages([]); setRoom(view) }

  if (!room) return <HomePage language={language} onLanguage={changeLanguage} onEnter={enterRoom} />
  if (room.phase === 'waiting') return <LobbyPage state={room} messages={messages} playerId={socket.id ?? ''} onLeave={leave} />
  return <GamePage state={room} messages={messages} playerId={socket.id ?? ''} onLeave={leave} />
}

export default App
