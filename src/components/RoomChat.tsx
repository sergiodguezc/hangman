import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatMessage } from '../../shared/protocol'
import type { MultiplayerTranslations } from '../multiplayer/i18n'
import { errorMessage } from '../multiplayer/i18n'
import { socket } from '../multiplayer/socket'

type Props = { messages: ChatMessage[]; currentPlayerId: string; t: MultiplayerTranslations }

export function RoomChat({ messages, currentPlayerId, t }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      else setText('')
      inputRef.current?.focus()
    })
  }

  return <section className="room-chat" aria-label={t.chatTitle}>
    <h2>{t.chatTitle}</h2>
    <div className="chat-messages" ref={listRef} aria-live="polite">
      {!messages.length && <p className="chat-empty">{t.chatEmpty}</p>}
      {messages.map((message) => <article key={message.id} className={message.senderId === currentPlayerId ? 'own' : ''}>
        <strong>{message.senderName}</strong><p>{message.text}</p>
      </article>)}
    </div>
    <form className="chat-form" onSubmit={send}>
      <input ref={inputRef} value={text} maxLength={300} aria-label={t.chatPlaceholder}
        placeholder={t.chatPlaceholder} onChange={(event) => setText(event.target.value)} />
      <button disabled={!text.trim()}>{t.chatSend}</button>
    </form>
    {error && <p className="chat-error" role="alert">{error}</p>}
  </section>
}
