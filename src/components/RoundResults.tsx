import type { PublicPlayer, RoundResultEntry } from '../../shared/protocol'
import type { MultiplayerTranslations } from '../multiplayer/i18n'

type Props = { results: RoundResultEntry[]; players: PublicPlayer[]; t: MultiplayerTranslations; showTitle?: boolean }

export function RoundResults({ results, players, t, showTitle = true }: Props) {
  if (!results.length) return null
  const names = new Map(players.map((player) => [player.id, player.name]))
  const timeLabel = (milliseconds: number | null) => {
    if (milliseconds === null) return null
    const seconds = milliseconds / 1000
    return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`
  }
  return <section className="round-results" {...showTitle ? { 'aria-labelledby': 'round-results-title' } : { 'aria-label': t.roundResults }}>
    {showTitle && <h2 id="round-results-title">{t.roundResults}</h2>}
    <ol className="round-results-list">{results.map((result) => {
      const outcome = result.status === 'setter'
        ? { label: t.setterRoundResult, kind: 'setter' }
        : result.status === 'solved' && result.forgiven
          ? { label: t.forgivenSolvedResult, kind: 'forgiven' }
          : result.status === 'solved'
            ? { label: t.normalSolvedResult, kind: 'solved' }
            : { label: t.failedRoundResult, kind: 'failed' }
      const metadata = result.status === 'setter'
        ? [t.setterRoundResult]
        : [result.errors === null ? null : t.errorCount(result.errors), result.status === 'solved' ? timeLabel(result.resolutionTimeMs) : t.failedRoundResult, result.status === 'solved' && result.forgiven ? t.forgivenResult : null].filter(Boolean)
      const playerName = names.get(result.playerId) ?? result.playerId
      return <li key={result.playerId} className={`round-result-row outcome-${outcome.kind}`}>
        <strong className="round-result-points" aria-label={t.roundPoints(result.pointsAwarded)}>+{result.pointsAwarded}</strong>
        <span className="round-result-content"><span className="round-result-player">{result.status === 'solved' && <span className="sr-only">{outcome.label}</span>}<span className="round-result-name" title={playerName}>{playerName}</span></span>
        <span className="round-result-meta">{metadata.join(' · ')}</span></span>
      </li>
    })}</ol>
  </section>
}
