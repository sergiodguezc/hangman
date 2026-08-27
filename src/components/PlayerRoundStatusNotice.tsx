import type { PlayerRoundStatus } from '../../shared/protocol'
import type { MultiplayerTranslations } from '../multiplayer/i18n'

export function PlayerRoundStatusNotice({ status, t }: { status: PlayerRoundStatus; t: MultiplayerTranslations }) {
  if (status === 'solved') return <div className="player-terminal-state solved-state" role="status">
    <strong>{t.youSolved}</strong><span>{t.waitingForOthers}</span>
  </div>
  if (status === 'failed' || status === 'eliminated') return <div className="player-terminal-state eliminated-state" role="status">
    <strong>{t.youAreOut}</strong><span>{t.roundFinishedForYou}</span>
  </div>
  return null
}
