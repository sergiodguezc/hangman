import type { Language } from './game.js'

export type MatchTarget = 3 | 5 | 10 | null
export type GamePhase = 'waiting' | 'choosing-word' | 'guessing' | 'forgiveness-pending' | 'round-over' | 'match-over' | 'disconnected'
export type ConnectionState = 'connected' | 'reconnecting'
export type Player = { id: string; name: string; score: number; connectionState: ConnectionState }
export type RoomSession = { roomCode: string; playerId: string; reconnectToken: string }
export type RoomEntry = { view: PlayerGameView; session: RoomSession }
export const REACTION_TYPES = ['❤️', '😂', '💀'] as const
export type ReactionType = typeof REACTION_TYPES[number]
export type MessageReactions = Record<ReactionType, string[]>
export type ChatMessage = { id: string; senderId: string; senderName: string; text: string; timestamp: number; reactions: MessageReactions }
export type MatchResult = { kind: 'win'; winnerId: string } | { kind: 'draw' } | null

export type PlayerGameView = {
  code: string
  language: Language
  matchTarget: MatchTarget
  players: Player[]
  phase: GamePhase
  roundNumber: number
  wordSetterId: string | null
  guesserId: string | null
  roundWinnerId: string | null
  matchWinnerId: string | null
  matchResult: MatchResult
  matchEndingPending: boolean
  targetReachedPlayerId: string | null
  rematchReadyPlayerIds: string[]
  firstSetterId: string | null
  displayWord: string[]
  guessedLetters: string[]
  wrongLetters: string[]
  errors: number
  privateWord?: string
  reconnectedPlayerName?: string
  disconnectedPlayerName?: string
}

export type Ack<T = undefined> = (response: { ok: true; data: T } | { ok: false; error: string }) => void

export interface ClientToServerEvents {
  'room:create': (payload: { name: string; language: Language; matchTarget: MatchTarget }, ack: Ack<RoomEntry>) => void
  'room:join': (payload: { name: string; code: string }, ack: Ack<RoomEntry>) => void
  'room:resume': (payload: RoomSession, ack: Ack<PlayerGameView>) => void
  'round:set-word': (payload: { word: string }, ack: Ack) => void
  'game:guess': (payload: { letter: string }, ack: Ack) => void
  'round:forgiveness': (payload: { forgive: boolean }, ack: Ack) => void
  'round:continue': (ack: Ack) => void
  'chat:send': (payload: { text: string }, ack: Ack<ChatMessage>) => void
  'chat:react': (payload: { messageId: string; reaction: ReactionType }, ack: Ack<MessageReactions>) => void
  'chat:typing': (payload: { isTyping: boolean }) => void
  'match:rematch': (ack: Ack) => void
  'room:leave': () => void
}

export interface ServerToClientEvents {
  'room:state': (state: PlayerGameView) => void
  'room:error': (error: string) => void
  'chat:message': (message: ChatMessage) => void
  'chat:history': (messages: ChatMessage[]) => void
  'chat:reaction-updated': (payload: { messageId: string; reactions: MessageReactions }) => void
  'chat:typing': (payload: { playerId: string; playerName: string; isTyping: boolean }) => void
}
