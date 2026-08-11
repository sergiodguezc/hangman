import type { Language } from './game.js'

export type GamePhase = 'waiting' | 'choosing-word' | 'guessing' | 'forgiveness-pending' | 'round-over' | 'disconnected'
export type Player = { id: string; name: string; score: number }
export type ChatMessage = { id: string; senderId: string; senderName: string; text: string; timestamp: number }

export type PlayerGameView = {
  code: string
  language: Language
  players: Player[]
  phase: GamePhase
  roundNumber: number
  wordSetterId: string | null
  guesserId: string | null
  roundWinnerId: string | null
  displayWord: string[]
  guessedLetters: string[]
  wrongLetters: string[]
  errors: number
  privateWord?: string
  disconnectedPlayerName?: string
}

export type Ack<T = undefined> = (response: { ok: true; data: T } | { ok: false; error: string }) => void

export interface ClientToServerEvents {
  'room:create': (payload: { name: string; language: Language }, ack: Ack<PlayerGameView>) => void
  'room:join': (payload: { name: string; code: string }, ack: Ack<PlayerGameView>) => void
  'round:set-word': (payload: { word: string }, ack: Ack) => void
  'game:guess': (payload: { letter: string }, ack: Ack) => void
  'round:forgiveness': (payload: { forgive: boolean }, ack: Ack) => void
  'round:continue': (ack: Ack) => void
  'chat:send': (payload: { text: string }, ack: Ack<ChatMessage>) => void
  'room:leave': () => void
}

export interface ServerToClientEvents {
  'room:state': (state: PlayerGameView) => void
  'room:error': (error: string) => void
  'chat:message': (message: ChatMessage) => void
  'chat:history': (messages: ChatMessage[]) => void
}
