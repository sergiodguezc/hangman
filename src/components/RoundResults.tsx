import { MAX_ERRORS } from '../../shared/game'
import type { PublicPlayer, RoundResultEntry } from '../../shared/protocol'
import type { MultiplayerTranslations } from '../multiplayer/i18n'

type Props = { results: RoundResultEntry[]; players: PublicPlayer[]; t: MultiplayerTranslations }

export function RoundResults({ results, players, t }: Props) {
  if (!results.length) return null
  const names = new Map(players.map((player) => [player.id, player.name]))
  const timeLabel = (milliseconds: number | null) => {
    if (milliseconds === null) return null
    const seconds = milliseconds / 1000
    return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`
  }
  return <section className="round-results" aria-labelledby="round-results-title">
    <h2 id="round-results-title">{t.roundResults}</h2>
    <ol className="round-results-list">{results.map((result) => {
      const forgiven = result.status === 'solved' && result.errors !== null && result.errors >= MAX_ERRORS
      const outcome = result.status === 'setter'
        ? { icon: '✏️', label: t.setterRoundResult, kind: 'setter' }
        : result.status === 'solved' && forgiven
          ? { icon: '🟡', label: t.forgivenSolvedResult, kind: 'forgiven' }
          : result.status === 'solved'
            ? { icon: '🟢', label: t.normalSolvedResult, kind: 'solved' }
            : { icon: '🔴', label: t.failedRoundResult, kind: 'failed' }
      const metadata = result.status === 'setter'
        ? [t.setterRoundResult]
        : [result.status !== 'solved' ? t.failedRoundResult : null, result.errors === null ? null : t.errorCount(result.errors), timeLabel(result.resolutionTimeMs), forgiven ? t.forgivenResult : null].filter(Boolean)
      const playerName = names.get(result.playerId) ?? result.playerId
      return <li key={result.playerId} className={`round-result-row outcome-${outcome.kind}`}>
        <strong className="round-result-points" aria-label={t.roundPoints(result.pointsAwarded)}>+{result.pointsAwarded}</strong>
        <span className="round-result-player"><span className="round-result-outcome" role="img" aria-label={outcome.label}>{outcome.icon}</span><span className="round-result-name" title={playerName}>{playerName}</span></span>
        <span className="round-result-meta">{metadata.join(' · ')}</span>
      </li>
    })}</ol>
  </section>
}
