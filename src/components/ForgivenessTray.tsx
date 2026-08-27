import type { ForgivenessRequest, PublicPlayer } from '../../shared/protocol'
import type { MultiplayerTranslations } from '../multiplayer/i18n'

type Props = {
  requests: ForgivenessRequest[]
  players: PublicPlayer[]
  t: MultiplayerTranslations
  onDecide: (requestId: string, forgive: boolean) => void
}

export function ForgivenessTray({ requests, players, t, onDecide }: Props) {
  if (!requests.length) return null
  const names = new Map(players.map((player) => [player.id, player.name]))
  return <aside className="forgiveness-tray" role="region" aria-label={t.forgivenessQueue}>
    <strong>{t.forgivenessQueue}</strong>
    <div className="forgiveness-tray-list">{requests.map((request) => <div className="forgiveness-request" key={request.id}>
      <span><b>{names.get(request.playerId) ?? request.playerId}</b> {t.requestsForgiveness}</span>
      <div><button className="forgive-action" onClick={() => onDecide(request.id, true)}>{t.forgive}</button><button className="deny-action" onClick={() => onDecide(request.id, false)}>{t.doNotForgive}</button></div>
    </div>)}</div>
  </aside>
}
