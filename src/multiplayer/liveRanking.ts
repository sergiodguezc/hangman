import type { PublicPlayer } from '../../shared/protocol'
import { rankByScore } from '../../shared/ranking'

/** From this many participants, layouts below the three-column desktop (phones, tablets and the 1000–1299px sidebar)
 * collapse the live ranking to a summary. */
export const COMPACT_RANKING_MIN_PLAYERS = 4
/** Up to this many leaders are named in the summary; larger first-place ties are summarised with a count. */
export const NAMED_LEADERS_MAX = 2

/** Live ranking for active gameplay: active players with shared competition ranks, departed players kept apart.
 * The current player is identified by ID only, so duplicate display names never confuse the "you" marker. */
export function liveRanking(players: readonly PublicPlayer[], currentId: string) {
  const ranked = rankByScore(players.filter((player) => player.active))
  const departed = players.filter((player) => !player.active)
  const leaders = ranked.filter(({ rank }) => rank === 1)
  const self = ranked.find(({ player }) => player.id === currentId) ?? null
  const selfShared = Boolean(self && ranked.some(({ player, rank }) => rank === self.rank && player.id !== currentId))
  const namedLeaders = leaders.length <= NAMED_LEADERS_MAX
  return {
    ranked, departed, leaders, self, selfShared, namedLeaders,
    // The self line is redundant only when the player already appears by name among the leaders.
    showSelfLine: Boolean(self && !(namedLeaders && self.rank === 1)),
    collapsible: players.length >= COMPACT_RANKING_MIN_PLAYERS,
  }
}
