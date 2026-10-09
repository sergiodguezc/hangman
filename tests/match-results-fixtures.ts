import type { MatchResult, PlayerGameView, PublicPlayer, RoundResultEntry } from '../shared/protocol'

// Match-over snapshots shaped like GameRoom.viewFor() output. Shared by the unit tests and the visual QA harness.
type FixturePlayer = { id: string; name: string; score: number; presence?: 'connected' | 'reconnecting' | 'departed' }
type FixtureOptions = { players: FixturePlayer[]; ready?: string[]; word?: string | null; results?: RoundResultEntry[]; matchResult?: MatchResult; setterId?: string }

export function matchOverView({ players, ready = [], word = 'PLATJA', results, matchResult, setterId }: FixtureOptions): PlayerGameView {
  const publicPlayers: PublicPlayer[] = players.map(({ id, name, score, presence = 'connected' }) => ({
    id, name, score, active: presence !== 'departed', roundStatus: 'solved',
    connectionState: presence === 'departed' ? 'disconnected' : presence,
  }))
  const roster = players.map(({ id }) => id)
  const ranking = [...players].sort((a, b) => b.score - a.score || roster.indexOf(a.id) - roster.indexOf(b.id)).map(({ id }) => id)
  const setter = setterId ?? roster[roster.length - 1]
  const setterResult: RoundResultEntry = { playerId: setter, position: null, status: 'setter', forgiven: false, errors: null, resolutionTimeMs: null, pointsAwarded: 0 }
  const guesserResults: RoundResultEntry[] = roster.filter((id) => id !== setter).map((playerId, index) => ({
    playerId, position: index + 1, status: 'solved', forgiven: false, errors: index % 3, resolutionTimeMs: 4000 + index * 1500, pointsAwarded: roster.length - 1 - index,
  }))
  const roundResults = results ?? (word ? [...guesserResults, setterResult] : [setterResult])
  return {
    code: 'K7QF2', gameLanguage: 'ca', voltes: 1, players: publicPlayers, roomStatus: 'match-over', hostId: roster[0],
    match: { status: 'match-over', ownerId: roster[0], turnOrder: roster, turnIndex: roster.length - 1, voltaNumber: 1, completedTurns: roster.length, totalTurns: roster.length, rematchReadyPlayerIds: ready },
    round: { id: 'r-last', number: roster.length, voltaNumber: 1, setterId: setter, nextSetterId: null, status: word ? 'round-over' : 'choosing-word', ranking: [], results: roundResults },
    self: word ? { playerId: roster[0], status: 'solved', guessedLetters: [], wrongLetters: [], errors: 0, displayWord: word.split(''), forgiven: false, startedAt: 0, finishedAt: 1, resolutionTimeMs: 1, roundRank: 1 } : null,
    observedPlayerId: null, forgivenessRequests: [],
    matchResult: matchResult === undefined ? { ranking, scores: Object.fromEntries(players.map(({ id, score }) => [id, score])) } : matchResult,
    ...(word ? { privateWord: word } : {}),
  }
}

const tenNames = ['Júlia', 'Marc', 'Anna Maria de la Concepció i Puigdomènech', 'Sergio', 'Pol', 'Núria', 'Biel', 'Ona', 'Quim', 'Laia']
const tenScores = [27, 24, 22, 21, 19, 17, 15, 12, 9, 4]

/** Named scenarios; `self` is the viewing player's authoritative ID. */
export const matchResultScenarios: Record<string, { self: string; view: PlayerGameView }> = {
  'two-win': { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 12 }, { id: 'j', name: 'Júlia', score: 9 }] }) },
  'two-loss': { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 9 }, { id: 'j', name: 'Júlia', score: 12 }] }) },
  'two-tie': { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 8 }, { id: 'j', name: 'Júlia', score: 8 }] }) },
  'four-tie-departed': { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 8 }, { id: 'j', name: 'Júlia', score: 8 }, { id: 'm', name: 'Marc', score: 5 }, { id: 'l', name: 'Laia', score: 3, presence: 'departed' }], ready: ['j'] }) },
  'others-tied': { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 3 }, { id: 'j', name: 'Júlia', score: 8 }, { id: 'm', name: 'Marc', score: 8 }, { id: 'p', name: 'Pol', score: 5 }] }) },
  'many-leaders': { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 8 }, { id: 'j', name: 'Júlia', score: 8 }, { id: 'm', name: 'Marc', score: 8 }, { id: 'p', name: 'Pol', score: 8 }, { id: 'n', name: 'Núria', score: 6 }], ready: ['s', 'j', 'm'] }) },
  'all-zero': { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 0 }, { id: 'j', name: 'Júlia', score: 0 }, { id: 'm', name: 'Marc', score: 0 }] }) },
  'lower-tie': { self: 's', view: matchOverView({ players: [{ id: 'j', name: 'Júlia', score: 9 }, { id: 's', name: 'Sergio', score: 5 }, { id: 'm', name: 'Marc', score: 5 }] }) },
  ten: { self: 'p3', view: matchOverView({ players: tenNames.map((name, index) => ({ id: `p${index}`, name, score: tenScores[index], presence: index === 6 ? 'departed' : index === 8 ? 'reconnecting' : 'connected' })), ready: ['p0', 'p1'] }) },
  'long-names': { self: 'd2', view: matchOverView({ players: [
    { id: 'd1', name: 'Maria Antònia Fernández de Castro i Vilallonga', score: 128 },
    { id: 'd2', name: 'Maria Antònia Fernández de Castro i Vilallonga', score: 104 },
    { id: 'x', name: 'Supercalifragilisticexpialidociousssssssssssssss', score: 99, presence: 'reconnecting' },
    { id: 'y', name: 'Jo', score: 7 },
  ] }) },
  'departed-winner': { self: 's', view: matchOverView({ players: [{ id: 'j', name: 'Júlia', score: 14, presence: 'departed' }, { id: 's', name: 'Sergio', score: 10 }, { id: 'm', name: 'Marc', score: 6 }] }) },
  reconnecting: { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 6 }, { id: 'j', name: 'Júlia', score: 4, presence: 'reconnecting' }, { id: 'm', name: 'Marc', score: 2 }], ready: ['s'] }) },
  'ready-waiting': { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 6 }, { id: 'j', name: 'Júlia', score: 7 }, { id: 'm', name: 'Marc', score: 2 }, { id: 'p', name: 'Pol', score: 2 }], ready: ['s', 'm'] }) },
  unavailable: { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 12 }, { id: 'j', name: 'Júlia', score: 9, presence: 'departed' }], ready: [] }) },
  interrupted: { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 0 }, { id: 'j', name: 'Júlia', score: 0, presence: 'departed' }], word: null, setterId: 'j' }) },
  'missing-result': { self: 's', view: matchOverView({ players: [{ id: 's', name: 'Sergio', score: 3 }, { id: 'j', name: 'Júlia', score: 5 }], matchResult: null }) },
}
