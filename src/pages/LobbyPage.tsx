import { useState } from 'react'
import type { ChatMessage, PlayerGameView } from '../../shared/protocol'
import { RoomChat } from '../components/RoomChat'
import { getLanguageConfig } from '../game/languages'
import { multiplayerTranslations } from '../multiplayer/i18n'

export function LobbyPage({ state, messages, playerId, typingPlayer, onLeave }: { state: PlayerGameView; messages: ChatMessage[]; playerId: string; typingPlayer: { playerId: string; playerName: string } | null; onLeave: () => void }) {
  const [copied, setCopied] = useState(false)
  const t = multiplayerTranslations[state.language]
  const copy = async () => { await navigator.clipboard.writeText(state.code); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }
  return <main className="lobby-page" lang={state.language}>
    <div className="lobby-layout"><section className="lobby-card">
      <span className="eyebrow">{t.share}</span><div className="room-code">{state.code}</div>
      <button className="copy-button" onClick={copy}>{copied ? t.copied : t.copy}</button>
      <div className="waiting-pulse"><i /><span>{t.waiting}</span></div>
      <div className="lobby-meta"><span>{getLanguageConfig(state.language).name}</span><span>{t.matchObjective.replace('{target}', state.matchTarget === null ? t.unlimited.toLocaleLowerCase(state.language) : t.points.replace('{target}', String(state.matchTarget)))}</span><span>{state.players.length} / 2 {t.players}</span></div>
      <ul className="player-list">{state.players.map((player) => <li key={player.id}><span>{player.name.charAt(0)}</span>{player.name}</li>)}</ul>
      <button className="text-button" onClick={onLeave}>{t.leave}</button>
    </section><RoomChat messages={messages} currentPlayerId={playerId} typingPlayer={typingPlayer} t={t} /></div>
  </main>
}
