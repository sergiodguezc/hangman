import type { PublicPlayer } from '../../shared/protocol'
import type { MultiplayerTranslations } from '../multiplayer/i18n'

type Props = { players: PublicPlayer[]; setterId: string | null; currentId: string; t: MultiplayerTranslations }

export function Scoreboard({ players, setterId, currentId, t }: Props) {
  const ranked = [...players].sort((a, b) => b.score - a.score || players.indexOf(a) - players.indexOf(b))
  return <aside className="scoreboard">
    <h2>{t.ranking}</h2>
    <ol>{ranked.map((player, index) => {
      const tied = index > 0 && ranked[index - 1].score === player.score
      return <li key={player.id}>
        <span className="rank">{tied ? index : index + 1}</span>
        <span className="player-name">{player.name}{player.id === currentId ? ` · ${t.you}` : ''}</span>
        <strong>{player.score}</strong>
        <small>{player.id === setterId ? t.setterStatus : player.roundStatus === 'solved' ? t.solved : player.roundStatus === 'awaiting-forgiveness' ? t.awaitingForgiveness : player.roundStatus === 'failed' || player.roundStatus === 'eliminated' ? t.eliminated : t.guessing}</small>
      </li>
    })}</ol>
  </aside>
}
