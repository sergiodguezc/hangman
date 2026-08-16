import { useState } from 'react'
import type { ChatMessage, PlayerGameView } from '../../shared/protocol'
import { RoomChat } from '../components/RoomChat'
import { getLanguageConfig } from '../game/languages'
import { invitationUrl } from '../multiplayer/invitations'
import { multiplayerTranslations } from '../multiplayer/i18n'

export function LobbyPage({ state, interfaceLanguage, messages, playerId, typingPlayer }: { state: PlayerGameView; interfaceLanguage: 'ca' | 'es'; messages: ChatMessage[]; playerId: string; typingPlayer: { playerId: string; playerName: string } | null }) {
  const [copied, setCopied] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const t = multiplayerTranslations[interfaceLanguage]
  const copy = async () => { await navigator.clipboard.writeText(state.code); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }
  const invite = async () => {
    const url = invitationUrl(window.location.origin, state.code)
    const shareData = { title: t.inviteTitle, text: t.inviteText.replace('{code}', state.code), url }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }
      await navigator.clipboard.writeText(url)
      setInviteStatus('copied')
      window.setTimeout(() => setInviteStatus('idle'), 1800)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setInviteStatus('failed')
      window.setTimeout(() => setInviteStatus('idle'), 2200)
    }
  }
  const canInvite = state.players.length < 2
  return <main className="lobby-page" lang={interfaceLanguage}>
    <div className="lobby-layout"><section className="lobby-card">
      <span className="eyebrow">{t.share}</span><div className="room-code">{state.code}</div>
      <button className="copy-button" onClick={copy}>{copied ? t.copied : t.copy}</button>
      {canInvite && <div className="lobby-invite">
        <button className="primary-action lobby-invite-button" type="button" onClick={invite}>{t.challengeFriend}</button>
        {inviteStatus !== 'idle' && <p role="status">{inviteStatus === 'copied' ? t.inviteCopied : t.inviteFailed}</p>}
      </div>}
      <div className="waiting-pulse"><i /><span>{t.waiting}</span></div>
      <div className="lobby-meta"><span>{getLanguageConfig(state.gameLanguage).name}</span><span>{t.matchObjective.replace('{target}', state.matchTarget === null ? t.unlimited.toLocaleLowerCase(interfaceLanguage) : t.points.replace('{target}', String(state.matchTarget)))}</span><span>{state.players.length} / 2 {t.players}</span></div>
      <ul className="player-list">{state.players.map((player) => <li key={player.id}><span>{player.name.charAt(0)}</span>{player.name}</li>)}</ul>
    </section><RoomChat messages={messages} currentPlayerId={playerId} typingPlayer={typingPlayer} t={t} /></div>
  </main>
}
