import type { Player } from '../../shared/protocol'
import type { MultiplayerTranslations } from '../multiplayer/i18n'

type Props = { players: Player[]; setterId: string | null; guesserId: string | null; currentId: string; t: MultiplayerTranslations }

export function Scoreboard({ players, setterId, guesserId, currentId, t }: Props) {
  const ranked = [...players].sort((a, b) => b.score - a.score || players.indexOf(a) - players.indexOf(b))
  return <aside className="scoreboard">
    <h2>{t.ranking}</h2>
    <ol>{ranked.map((player, index) => {
      const tied = index > 0 && ranked[index - 1].score === player.score
      return <li key={player.id}>
        <span className="rank">{tied ? index : index + 1}</span>
        <span className="player-name">{player.name}{player.id === currentId ? ' · tú' : ''}</span>
        <strong>{player.score}</strong>
        <small>{player.id === setterId ? t.choosing : player.id === guesserId ? t.guessing : ''}</small>
      </li>
    })}</ol>
  </aside>
}
