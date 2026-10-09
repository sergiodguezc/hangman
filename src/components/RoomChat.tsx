import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { REACTION_TYPES, type ChatMessage, type ReactionType } from '../../shared/protocol'
import type { MultiplayerTranslations } from '../multiplayer/i18n'
import { errorMessage } from '../multiplayer/i18n'
import { socket } from '../multiplayer/socket'

type Props = { messages: ChatMessage[]; currentPlayerId: string; typingPlayers: { playerId: string; playerName: string }[]; t: MultiplayerTranslations }

export function RoomChat({ messages, currentPlayerId, typingPlayers, t }: Props) {
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

  return <section className={`room-chat${messages.length ? '' : ' is-empty'}`} aria-label={t.chatTitle}>
    <h2>{t.chatTitle}</h2>
    <div className="chat-messages" ref={listRef} aria-live="polite">
      {!messages.length && <p className="chat-empty">{t.chatEmpty}</p>}
      {messages.map((message) => <article key={message.id} className={`${message.senderId === currentPlayerId ? 'own ' : ''}${openMessageId === message.id ? 'reactions-open' : ''}`.trim()}>
        <strong>{message.senderName}</strong>
        <div className="chat-message-body">
          <p>{message.text}</p>
          <MessageReactions message={message} currentPlayerId={currentPlayerId} t={t} labels={reactionLabels}
            open={openMessageId === message.id} onOpen={(open) => setOpenMessageId(open ? message.id : null)} onReact={react} />
        </div>
      </article>)}
    </div>
    {typingPlayers.filter((player) => player.playerId !== currentPlayerId).map((player) => <p key={player.playerId} className="typing-indicator" role="status">{t.typing.replace('{player}', player.playerName)}</p>)}
    <form className="chat-form" onSubmit={send}>
      <input ref={inputRef} value={text} maxLength={300} aria-label={t.chatPlaceholder}
        placeholder={t.chatPlaceholder} onChange={(event) => { const next = event.target.value; setText(next); window.clearTimeout(typingTimer.current); if (!next.trim()) stopTyping(); else { if (!isTyping.current) { isTyping.current = true; socket.emit('chat:typing', { isTyping: true }) } typingTimer.current = window.setTimeout(stopTyping, 2000) } }} />
      <button disabled={!text.trim()}>{t.chatSend}</button>
    </form>
    {error && <p className="chat-error" role="alert">{error}</p>}
  </section>
}

function MessageReactions({ message, currentPlayerId, t, labels, open, onOpen, onReact }: {
  message: ChatMessage; currentPlayerId: string; t: MultiplayerTranslations; labels: Record<ReactionType, string>
  open: boolean; onOpen: (open: boolean) => void; onReact: (messageId: string, reaction: ReactionType) => void
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const picker = useRef<HTMLDivElement>(null)
  useEffect(() => { if (open) picker.current?.querySelector('button')?.focus() }, [open])
  const close = () => { onOpen(false); trigger.current?.focus() }
  return <div className="message-reactions" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) onOpen(false)
  }} onKeyDown={(event) => {
    if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
  }}>
    <div className="reaction-actions">
      <button ref={trigger} type="button" className="reaction-trigger" aria-label={t.addReaction.replace('{player}', message.senderName)}
        aria-expanded={open} aria-controls={id} onClick={() => onOpen(!open)}><span aria-hidden="true">☺+</span></button>
      <div className="active-reactions">{REACTION_TYPES.filter((reaction) => message.reactions[reaction].length > 0).map((reaction) => <button type="button" key={reaction}
        aria-label={`${labels[reaction]} · ${message.reactions[reaction].length}`} aria-pressed={message.reactions[reaction].includes(currentPlayerId)}
        onClick={() => {
          onReact(message.id, reaction)
          if (message.reactions[reaction].length === 1 && message.reactions[reaction].includes(currentPlayerId)) trigger.current?.focus()
        }}>{reaction}<span>{message.reactions[reaction].length}</span></button>)}</div>
    </div>
    <div ref={picker} id={id} className="reaction-picker" role="group" aria-label={t.reactions} hidden={!open}>
      {REACTION_TYPES.map((reaction) => <button type="button" key={reaction} aria-label={labels[reaction]}
        aria-pressed={message.reactions[reaction].includes(currentPlayerId)} onClick={() => { onReact(message.id, reaction); close() }}>{reaction}</button>)}
    </div>
  </div>
}
