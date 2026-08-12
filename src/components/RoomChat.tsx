import { useEffect, useRef, useState, type FormEvent } from 'react'
import { REACTION_TYPES, type ChatMessage, type ReactionType } from '../../shared/protocol'
import type { MultiplayerTranslations } from '../multiplayer/i18n'
import { errorMessage } from '../multiplayer/i18n'
import { socket } from '../multiplayer/socket'

type Props = { messages: ChatMessage[]; currentPlayerId: string; typingPlayer: { playerId: string; playerName: string } | null; t: MultiplayerTranslations }

export function RoomChat({ messages, currentPlayerId, typingPlayer, t }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [openMessageId, setOpenMessageId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimer = useRef<number | undefined>(undefined)
  const isTyping = useRef(false)

  const stopTyping = () => { window.clearTimeout(typingTimer.current); typingTimer.current = undefined; if (isTyping.current) { isTyping.current = false; socket.emit('chat:typing', { isTyping: false }) } }
  useEffect(() => () => stopTyping(), [])

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  const send = (event: FormEvent) => {
    event.preventDefault()
    const message = text.trim()
    if (!message) return
    setError('')
    socket.emit('chat:send', { text: message }, (response) => {
      if (!response.ok) setError(errorMessage(response.error, t))
      else { setText(''); stopTyping() }
      inputRef.current?.focus()
    })
  }

  const reactionLabels: Record<ReactionType, string> = { '❤️': t.reactionHeart, '😂': t.reactionLaugh, '💀': t.reactionSkull }
  const react = (messageId: string, reaction: ReactionType) => socket.emit('chat:react', { messageId, reaction }, (response) => {
    if (!response.ok) setError(errorMessage(response.error, t))
  })

  return <section className="room-chat" aria-label={t.chatTitle}>
    <h2>{t.chatTitle}</h2>
    <div className="chat-messages" ref={listRef} aria-live="polite">
      {!messages.length && <p className="chat-empty">{t.chatEmpty}</p>}
      {messages.map((message) => <article key={message.id} className={`${message.senderId === currentPlayerId ? 'own ' : ''}${openMessageId === message.id ? 'reactions-open' : ''}`.trim()}>
        <strong>{message.senderName}</strong>
        <div className="chat-message-body" onClick={() => setOpenMessageId((current) => current === message.id ? null : message.id)}>
          <div className="reaction-picker" role="group">{REACTION_TYPES.map((reaction) => <button type="button" key={reaction} aria-label={reactionLabels[reaction]}
            aria-pressed={message.reactions[reaction].includes(currentPlayerId)} onClick={(event) => { event.stopPropagation(); react(message.id, reaction) }}>{reaction}</button>)}</div>
          <p>{message.text}</p>
          <div className="active-reactions">{REACTION_TYPES.filter((reaction) => message.reactions[reaction].length > 0).map((reaction) => <button type="button" key={reaction}
            aria-label={reactionLabels[reaction]} aria-pressed={message.reactions[reaction].includes(currentPlayerId)} onClick={(event) => { event.stopPropagation(); react(message.id, reaction) }}>{reaction}</button>)}</div>
        </div>
      </article>)}
    </div>
    {typingPlayer && typingPlayer.playerId !== currentPlayerId && <p className="typing-indicator" role="status">{t.typing.replace('{player}', typingPlayer.playerName)}</p>}
    <form className="chat-form" onSubmit={send}>
      <input ref={inputRef} value={text} maxLength={300} aria-label={t.chatPlaceholder}
        placeholder={t.chatPlaceholder} onChange={(event) => { const next = event.target.value; setText(next); window.clearTimeout(typingTimer.current); if (!next.trim()) stopTyping(); else { if (!isTyping.current) { isTyping.current = true; socket.emit('chat:typing', { isTyping: true }) } typingTimer.current = window.setTimeout(stopTyping, 2000) } }} />
      <button disabled={!text.trim()}>{t.chatSend}</button>
    </form>
    {error && <p className="chat-error" role="alert">{error}</p>}
  </section>
}
