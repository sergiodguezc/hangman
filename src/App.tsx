import { useEffect, useState } from 'react'
import type { Language } from '../shared/game'
import type { ChatMessage, PlayerGameView } from '../shared/protocol'
import { GamePage } from './pages/GamePage'
import { HomePage } from './pages/HomePage'
import { LobbyPage } from './pages/LobbyPage'
import { clearRoomSession, loadRoomSession, socket } from './multiplayer/socket'
import './App.css'

function App() {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('hangman-language') === 'ca' ? 'ca' : 'es')
  const [room, setRoom] = useState<PlayerGameView | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [playerId, setPlayerId] = useState(() => loadRoomSession()?.playerId ?? '')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const update = (state: PlayerGameView) => { setRoom(state); setLanguage(state.language) }
    socket.on('room:state', update)
    const history = (chatMessages: ChatMessage[]) => setMessages(chatMessages)
    const message = (chatMessage: ChatMessage) => setMessages((current) => [...current, chatMessage].slice(-50))
    socket.on('chat:history', history)
    socket.on('chat:message', message)
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
    return () => { socket.off('room:state', update); socket.off('chat:history', history); socket.off('chat:message', message); socket.off('connect', resume) }
  }, [])

  const changeLanguage = (next: Language) => { setLanguage(next); localStorage.setItem('hangman-language', next) }
  const leave = () => { socket.emit('room:leave'); clearRoomSession(); setPlayerId(''); setRoom(null); setMessages([]) }
  const enterRoom = (view: PlayerGameView, id: string) => { setMessages([]); setPlayerId(id); setNotice(''); setRoom(view) }

  if (!room) return <HomePage language={language} notice={notice} onLanguage={changeLanguage} onEnter={enterRoom} />
  if (room.phase === 'waiting') return <LobbyPage state={room} messages={messages} playerId={playerId} onLeave={leave} />
  return <GamePage state={room} messages={messages} playerId={playerId} onLeave={leave} />
}

export default App
