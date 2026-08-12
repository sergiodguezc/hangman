import { displayWord, isCorrectGuess, isWordComplete, normalizeGuess, validateSecretWord, type Language } from '../../shared/game.js'
import { randomUUID } from 'node:crypto'
import { REACTION_TYPES, type ChatMessage, type MessageReactions, type Player, type PlayerGameView, type GamePhase, type MatchResult, type MatchTarget, type ReactionType } from '../../shared/protocol.js'

export type RoomPlayer = Player & { socketId: string | null; reconnectToken: string }

const MAX_ERRORS = 6
const MAX_CHAT_MESSAGES = 50
const MAX_CHAT_LENGTH = 300

export class GameRoom {
  readonly players: RoomPlayer[] = []
  phase: GamePhase = 'waiting'
  roundNumber = 0
  wordSetterId: string | null = null
  guesserId: string | null = null
  roundWinnerId: string | null = null
  matchWinnerId: string | null = null
  matchResult: MatchResult = null
  targetReachedPlayerId: string | null = null
  readonly rematchReady = new Set<string>()
  firstSetterId: string | null = null
  private secretWord: string | null = null
  private readonly guesses = new Set<string>()
  private errorCount = 0
  private readonly chatMessages: ChatMessage[] = []
  reconnectedPlayerName?: string
  disconnectedPlayerName?: string

  constructor(readonly code: string, readonly language: Language, readonly matchTarget: MatchTarget = null, private readonly random = Math.random) {}

  addPlayer(id: string, socketId: string, reconnectToken: string, name: string) {
    if (this.players.length >= 2) throw new Error('room-full')
    this.players.push({ id, socketId, reconnectToken, name, score: 0, connectionState: 'connected' })
    if (this.players.length === 2) {
      this.startMatch()
    }
  }

  player(id: string) { return this.players.find((player) => player.id === id) }

  markReconnecting(playerId: string, socketId: string) {
    const player = this.player(playerId)
    if (!player || player.socketId !== socketId) return false
    player.socketId = null
    player.connectionState = 'reconnecting'
    this.reconnectedPlayerName = undefined
    return true
  }

  resume(playerId: string, reconnectToken: string, socketId: string) {
    const player = this.player(playerId)
    if (!player || player.reconnectToken !== reconnectToken) throw new Error('resume-rejected')
    player.socketId = socketId
    player.connectionState = 'connected'
    this.reconnectedPlayerName = player.name
    return player
  }

  assertPlayable() {
    if (this.players.some((player) => player.connectionState !== 'connected')) throw new Error('opponent-reconnecting')
  }

  setWord(playerId: string, input: unknown) {
    this.assertPlayable()
    if (this.phase !== 'choosing-word' || playerId !== this.wordSetterId) throw new Error('not-word-setter')
    const word = validateSecretWord(input, this.language)
    if (!word) throw new Error('invalid-word')
    this.secretWord = word
    this.guesses.clear()
    this.errorCount = 0
    this.roundWinnerId = null
    this.phase = 'guessing'
  }

  guess(playerId: string, input: unknown) {
    this.assertPlayable()
    if (this.phase !== 'guessing' || playerId !== this.guesserId || !this.secretWord) throw new Error('not-guesser')
    if (typeof input !== 'string') throw new Error('invalid-guess')
    const guess = normalizeGuess(input, this.language)
    if (!guess) throw new Error('invalid-guess')
    if (this.guesses.has(guess)) return
    this.guesses.add(guess)
    if (isWordComplete(this.secretWord, this.guesses, this.language)) {
      this.finishRound(this.guesserId)
      return
    }
    if (!isCorrectGuess(this.secretWord, guess, this.language)) {
      this.errorCount += 1
      if (this.errorCount >= MAX_ERRORS) this.phase = 'forgiveness-pending'
    }
  }

  decideForgiveness(playerId: string, forgive: unknown) {
    this.assertPlayable()
    if (this.phase !== 'forgiveness-pending' || playerId !== this.wordSetterId || this.errorCount !== MAX_ERRORS) {
      throw new Error('cannot-decide-forgiveness')
    }
    if (typeof forgive !== 'boolean') throw new Error('invalid-forgiveness')
    if (forgive) {
      this.errorCount -= 1
      this.phase = 'guessing'
    } else {
      this.finishRound(this.wordSetterId)
    }
  }

  continue(playerId: string) {
    this.assertPlayable()
    if (this.phase !== 'round-over' || playerId !== this.guesserId) throw new Error('cannot-continue')
    const oldSetter = this.wordSetterId
    this.wordSetterId = this.guesserId
    this.guesserId = oldSetter
    this.roundNumber += 1
    this.secretWord = null
    this.guesses.clear()
    this.errorCount = 0
    this.roundWinnerId = null
    this.phase = 'choosing-word'
  }

  requestRematch(playerId: string) {
    this.assertPlayable()
    if (this.phase !== 'match-over' || !this.player(playerId)) throw new Error('cannot-rematch')
    if (this.rematchReady.has(playerId)) throw new Error('rematch-already-ready')
    this.rematchReady.add(playerId)
    if (this.rematchReady.size === 2) this.startMatch(true)
  }

  disconnect(playerId: string) {
    const leaving = this.players.find((player) => player.id === playerId)
    if (!leaving) return
    this.players.splice(this.players.indexOf(leaving), 1)
    this.disconnectedPlayerName = leaving.name
    if (this.players.length) this.phase = 'disconnected'
  }

  addChatMessage(playerId: string, input: unknown): ChatMessage {
    this.assertPlayable()
    const sender = this.players.find((player) => player.id === playerId)
    if (!sender) throw new Error('not-room-member')
    if (typeof input !== 'string') throw new Error('invalid-chat-message')
    const text = input.trim()
    if (!text) throw new Error('empty-chat-message')
    if (text.length > MAX_CHAT_LENGTH) throw new Error('chat-message-too-long')
    const reactions: MessageReactions = { '❤️': [], '😂': [], '💀': [] }
    const message = { id: randomUUID(), senderId: sender.id, senderName: sender.name, text, timestamp: Date.now(), reactions }
    this.chatMessages.push(message)
    if (this.chatMessages.length > MAX_CHAT_MESSAGES) this.chatMessages.splice(0, this.chatMessages.length - MAX_CHAT_MESSAGES)
    return message
  }

  toggleChatReaction(playerId: string, messageId: unknown, reaction: unknown): { messageId: string; reactions: MessageReactions } {
    this.assertPlayable()
    if (!this.player(playerId)) throw new Error('not-room-member')
    if (typeof messageId !== 'string') throw new Error('invalid-chat-message')
    if (typeof reaction !== 'string' || !REACTION_TYPES.includes(reaction as ReactionType)) throw new Error('invalid-reaction')
    const message = this.chatMessages.find((candidate) => candidate.id === messageId)
    if (!message) throw new Error('chat-message-not-found')
    const members = message.reactions[reaction as ReactionType]
    const index = members.indexOf(playerId)
    if (index === -1) members.push(playerId)
    else members.splice(index, 1)
    return { messageId, reactions: message.reactions }
  }

  get chatHistory(): ChatMessage[] {
    return [...this.chatMessages]
  }

  get wrongLetters() {
    if (!this.secretWord) return []
    return [...this.guesses].filter((guess) => !isCorrectGuess(this.secretWord!, guess, this.language))
  }

  viewFor(playerId: string): PlayerGameView {
    const reveal = this.phase === 'round-over' || this.phase === 'match-over'
    const view: PlayerGameView = {
      code: this.code, language: this.language, matchTarget: this.matchTarget, players: this.players.map(({ id, name, score, connectionState }) => ({ id, name, score, connectionState })), phase: this.phase,
      roundNumber: this.roundNumber, wordSetterId: this.wordSetterId, guesserId: this.guesserId,
      roundWinnerId: this.roundWinnerId, matchWinnerId: this.matchWinnerId,
      matchResult: this.matchResult, matchEndingPending: this.targetReachedPlayerId !== null,
      targetReachedPlayerId: this.targetReachedPlayerId,
      rematchReadyPlayerIds: [...this.rematchReady], firstSetterId: this.firstSetterId,
      displayWord: this.secretWord ? displayWord(this.secretWord, this.guesses, this.language, reveal) : [],
      guessedLetters: [...this.guesses], wrongLetters: this.wrongLetters, errors: this.errorCount,
      reconnectedPlayerName: this.reconnectedPlayerName,
      disconnectedPlayerName: this.disconnectedPlayerName,
    }
    if (this.secretWord && (playerId === this.wordSetterId || reveal)) view.privateWord = this.secretWord
    return view
  }

  private finishRound(winnerId: string | null) {
    if (!winnerId) return
    const winner = this.players.find((player) => player.id === winnerId)
    if (winner) winner.score += 1
    this.roundWinnerId = winnerId
    if (this.matchTarget === null) {
      this.phase = 'round-over'
      return
    }

    if (!this.targetReachedPlayerId && this.players.some((player) => player.score >= this.matchTarget!)) {
      this.targetReachedPlayerId = winnerId
    }
    if (this.targetReachedPlayerId && this.roundNumber % 2 === 0) this.resolveMatchResult()
    else this.phase = 'round-over'
  }

  private resolveMatchResult() {
    const [first, second] = this.players
    if (!first || !second) return
    if (first.score === second.score) {
      this.matchResult = { kind: 'draw' }
      this.matchWinnerId = null
    } else {
      const winner = first.score > second.score ? first : second
      this.matchResult = { kind: 'win', winnerId: winner.id }
      this.matchWinnerId = winner.id
    }
    this.targetReachedPlayerId = null
    this.phase = 'match-over'
  }

  private startMatch(resetScores = false) {
    if (this.players.length !== 2) return
    if (resetScores) for (const player of this.players) player.score = 0
    const setterIndex = this.random() < 0.5 ? 0 : 1
    this.wordSetterId = this.players[setterIndex].id
    this.guesserId = this.players[1 - setterIndex].id
    this.firstSetterId = this.wordSetterId
    this.roundNumber = 1
    this.secretWord = null
    this.guesses.clear()
    this.errorCount = 0
    this.roundWinnerId = null
    this.matchWinnerId = null
    this.matchResult = null
    this.targetReachedPlayerId = null
    this.rematchReady.clear()
    this.phase = 'choosing-word'
  }
}
