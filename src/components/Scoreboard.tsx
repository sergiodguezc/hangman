import type { MatchResult, PublicPlayer } from '../../shared/protocol'
import { rankByScore } from '../../shared/ranking'
import type { MultiplayerTranslations } from '../multiplayer/i18n'

type Props = { players: PublicPlayer[]; setterId: string | null; currentId: string; t: MultiplayerTranslations }

export function FinalScores({ players, result }: { players: PublicPlayer[]; result: MatchResult }) {
  const byId = new Map(players.map((player) => [player.id, player]))
  const participants = (result?.ranking ?? players.map((player) => player.id)).flatMap((id) => {
    const player = byId.get(id)
    return player ? [{ ...player, score: result?.scores[id] ?? player.score }] : []
  })
  return <div className="final-scores">{rankByScore(participants).map(({ player, rank }) => <span key={player.id}>{rank}. {player.name}<b>{player.score}</b></span>)}</div>
}

export function Scoreboard({ players, setterId, currentId, t }: Props) {
  const activePlayers = players.filter((player) => player.active)
  const departedPlayers = players.filter((player) => !player.active)
  const ranked = rankByScore(activePlayers)
  return <aside className="scoreboard">
    <h2>{t.ranking}</h2>
    <ol>{ranked.map(({ player, rank }) => {
      return <li key={player.id}>
        <span className="rank">{rank}</span>
        <span className="player-name">{player.name}{player.id === currentId ? ` · ${t.you}` : ''}</span>
        <strong>{player.score}</strong>
        <small>{player.id === setterId ? t.setterStatus : player.roundStatus === 'solved' ? t.solved : player.roundStatus === 'awaiting-forgiveness' ? t.awaitingForgiveness : player.roundStatus === 'failed' || player.roundStatus === 'eliminated' ? t.eliminated : t.guessing}</small>
      </li>
    })}</ol>
    {departedPlayers.length > 0 && <section className="departed-players" aria-labelledby="departed-players-title">
      <h3 id="departed-players-title">{t.departedPlayers}</h3>
      <ul>{departedPlayers.map((player) => <li key={player.id}>
        <span className="player-name" title={player.name}>{player.name}</span>
        <strong>{player.score}</strong>
      </li>)}</ul>
    </section>}
  </aside>
}
