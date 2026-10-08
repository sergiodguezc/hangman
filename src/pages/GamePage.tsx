import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { ALPHABETS, MAX_ERRORS, normalizeGuess } from '../../shared/game'
import type { Ack, ChatMessage, PlayerGameView } from '../../shared/protocol'
import { HangmanDrawing } from '../components/HangmanDrawing'
import { Keyboard } from '../components/Keyboard'
import { FinalScores, Scoreboard } from '../components/Scoreboard'
import { RoomChat } from '../components/RoomChat'
import { ForgivenessTray } from '../components/ForgivenessTray'
import { PlayerRoundStatusNotice } from '../components/PlayerRoundStatusNotice'
import { RoundResults } from '../components/RoundResults'
import { ObserverSelector } from '../components/ObserverSelector'
import { getLanguageConfig } from '../game/languages'
import { errorMessage, multiplayerTranslations } from '../multiplayer/i18n'
import { socket } from '../multiplayer/socket'
import { multiplayerPhase } from '../multiplayer/presentation'

type Props = { state: PlayerGameView; interfaceLanguage: 'ca' | 'es'; messages: ChatMessage[]; playerId: string; typingPlayers: { playerId: string; playerName: string }[] }

function groupDisplayWord(characters: string[]) {
  const words: { start: number; characters: string[] }[] = []
  let start = 0
  let current: string[] = []
  characters.forEach((character, index) => {
    if (character === ' ') {
      if (current.length) words.push({ start, characters: current })
      current = []; start = index + 1
    } else {
      if (!current.length) start = index
      current.push(character)
    }
  })
  if (current.length) words.push({ start, characters: current })
  return words
}

export function GamePage({ state, interfaceLanguage, messages, playerId, typingPlayers }: Props) {
  const [word, setWord] = useState('')
  const [error, setError] = useState('')
  const t = multiplayerTranslations[interfaceLanguage]
  const config = getLanguageConfig(state.gameLanguage)
  const phase = multiplayerPhase(state)
  const round = state.round
  const roundResults = round?.results ?? []
  const isSetter = round?.setterId === playerId
  const self = state.self
  const isGuesser = Boolean(self && !isSetter)
  const playersById = new Map(state.players.map((player) => [player.id, player]))
  const setter = round ? playersById.get(round.setterId) : undefined
  const observed = isSetter ? state.observedPlayer : self
  const guessed = new Set(observed?.guessedLetters ?? [])
  const wrong = new Set(observed?.wrongLetters ?? [])
  const displayWords = groupDisplayWord(observed?.displayWord ?? [])
  const wordSizing = { '--longest-word': Math.max(1, ...displayWords.map(({ characters }) => characters.length)) } as CSSProperties
  const pendingRequests = isSetter && phase === 'guessing' ? state.forgivenessRequests.filter((request) => request.status === 'pending') : []

  const handleAck = useCallback((response: Parameters<Ack>[0]) => {
    if (!response.ok) setError(errorMessage(response.error, t))
  }, [t])
  const guess = useCallback((letter: string) => {
    if (!isGuesser || self?.status !== 'playing' || phase !== 'guessing') return
    socket.emit('game:guess', { letter }, handleAck)
  }, [handleAck, isGuesser, phase, self?.status])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return
      const target = event.target
      if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return
      const normalized = normalizeGuess(event.key, state.gameLanguage)
      if (normalized) guess(normalized)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [guess, state.gameLanguage])

  const submitWord = (event: FormEvent) => {
    event.preventDefault(); setError('')
    socket.emit('round:set-word', { word }, (response) => { handleAck(response); if (response.ok) setWord('') })
  }
  const observePlayer = (observedPlayerId: string) => {
    setError('')
    socket.emit('round:observe-player', { playerId: observedPlayerId }, handleAck)
  }
  const decideForgiveness = (requestId: string, forgive: boolean) => {
    setError('')
    socket.emit('round:forgiveness', { requestId, forgive }, handleAck)
  }

  if (state.roomStatus === 'aborted' || state.roomStatus === 'closed') return <main className="disconnect-page"><section>
    <span className="disconnect-icon">!</span><h1>{t.disconnected}</h1>
  </section></main>

  const reconnectingPlayers = state.players.filter((player) => player.active && player.connectionState === 'reconnecting')
  const roundStatus = round?.status

  return <main className="match-page" lang={interfaceLanguage}>
    <header className="match-header">
      <div className="brand compact"><span className="brand-mark">P</span><h1>{t.title}</h1></div>
      <div className="match-meta"><span>{t.roomCode} <b>{state.code}</b></span><span>{t.round} <b>{state.match.completedTurns}/{state.match.totalTurns}</b></span><span>{t.voltes} <b>{round?.voltaNumber ?? state.match.voltaNumber}/{state.voltes}</b></span><span>{config.name}</span></div>
    </header>
    <div className="match-layout">
      <Scoreboard players={state.players} setterId={round?.setterId ?? null} currentId={playerId} t={t} />
      <ForgivenessTray requests={pendingRequests} players={state.players} t={t} onDecide={decideForgiveness} />
      <section className="multiplayer-game">
        {state.roomStatus === 'active' && reconnectingPlayers.length > 0 && <div className="form-error" role="status">{t.opponentReconnecting}</div>}
        {state.roomStatus === 'active' && state.reconnectedPlayerName && <div className="role-line" role="status">{t.opponentReconnected}</div>}
        {phase === 'choosing-word' && <>{round?.number === 1 && <div className="role-line" role="status">{isSetter ? t.youStart : t.playerStarts.replace('{player}', setter?.name ?? '')}</div>}{isSetter ? <form className="word-form" onSubmit={submitWord}>
          <span className="role-badge setter">✎ {t.chooseWord}</span>
          <input type="text" autoFocus maxLength={50} value={word} placeholder={t.secretPlaceholder} autoComplete="off" spellCheck={false} onChange={(e) => setWord(e.target.value)} />
          <p className="word-privacy">{t.wordPrivacy}</p>
          <button className="primary-action">{t.startRound}</button>
        </form> : <div className="phase-message"><div className="thinking">•••</div><h2>{setter?.name} {t.rivalChoosing}</h2></div>}</>}

        {phase === 'guessing' || roundStatus === 'round-over' ? <>
          <div className="role-line">{roundStatus === 'round-over' ? t.roundComplete : isSetter ? t.youChose : self?.status === 'awaiting-forgiveness' ? t.finalErrorGuesser : self?.status === 'solved' ? t.youSolved : self?.status === 'failed' || self?.status === 'eliminated' ? t.youAreOut : t.yourGuess}</div>
          {isSetter && state.roomStatus === 'active' && <ObserverSelector players={state.players.filter((player) => player.id !== playerId)} selectedPlayerId={state.observedPlayerId} t={t} onSelect={observePlayer} />}
          {observed ? <div className="game-columns"><div className="drawing-panel"><HangmanDrawing errors={observed.errors} label={t.errors} />
            <div className="error-copy"><span>{t.errors}</span><strong>{observed.errors} / {MAX_ERRORS}{observed.forgiven ? ' · ♥' : ''}</strong></div></div><div className="guess-area">
              <div className="multiplayer-word-scroll" tabIndex={0} style={wordSizing} aria-label={config.translations.progressLabel}><div className="multiplayer-word">{displayWords.map(({ start, characters }) => <span className="multiplayer-word-group" key={start}>{characters.map((character, offset) => <span key={start + offset} className={character === '_' ? 'blank' : normalizeGuess(character, state.gameLanguage) ? 'letter' : 'punctuation'}>{character === '_' ? '\u00a0' : character}</span>)}</span>)}</div></div>
              {isSetter && state.privateWord && <p className="setter-secret">{t.youChose}: <strong>{state.privateWord}</strong></p>}
              {phase === 'guessing' && !isSetter && self?.status === 'awaiting-forgiveness' && <div className="forgiveness-wait" role="status"><strong>{t.finalErrorGuesser}</strong><span>{t.waitingForgiveness}</span></div>}
              {!isSetter && self && <PlayerRoundStatusNotice phase={phase} status={self.status} t={t} />}
              {roundStatus === 'round-over' && <div className="round-result"><strong>{t.roundComplete}</strong><span>{t.wordWas}: {state.privateWord}</span></div>}
              <div className="incorrect-list"><span>{t.incorrect}</span><strong>{observed.wrongLetters.length ? observed.wrongLetters.join(' · ') : t.none}</strong></div>
              {!isSetter && <Keyboard alphabet={ALPHABETS[state.gameLanguage]} guesses={guessed} incorrect={wrong} disabled={self?.status !== 'playing' || phase !== 'guessing'} label={t.keyboard} onGuess={guess} />}
              {roundStatus === 'round-over' && round?.nextSetterId === playerId && state.roomStatus === 'active' && <button className="primary-action" onClick={() => socket.emit('round:continue', handleAck)}>{t.next}</button>}
              {roundStatus === 'round-over' && round?.nextSetterId !== playerId && state.roomStatus === 'active' && <p className="continue-note">{playersById.get(round?.nextSetterId ?? '')?.name} · {t.next}</p>}
            </div></div> : <div className="phase-message"><h2>{t.selectPlayer}</h2></div>}
          {roundStatus === 'round-over' && roundResults.length > 0 && <RoundResults results={roundResults} players={state.players} t={t} />}
        </> : null}

        {state.roomStatus === 'match-over' && <div className="match-result"><span className="role-badge">{t.matchComplete}</span><h2>{t.finalScore}</h2><FinalScores players={state.players} result={state.matchResult} />
          {!state.match.rematchReadyPlayerIds.includes(playerId) ? <button className="primary-action" onClick={() => socket.emit('match:rematch', handleAck)}>{t.rematch}</button> : <p>{t.waitingRematch}</p>}
          {state.match.rematchReadyPlayerIds.some((id) => id !== playerId) && !state.match.rematchReadyPlayerIds.includes(playerId) && <p>{t.opponentWantsRematch}</p>}
        </div>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
      <RoomChat messages={messages} currentPlayerId={playerId} typingPlayers={typingPlayers} t={t} />
    </div>
  </main>
}
